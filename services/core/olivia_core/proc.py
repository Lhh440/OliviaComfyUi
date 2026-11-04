"""ComfyUI 实例进程守护（PLAN §2）。

子进程一律参数数组传递（AGENTS.md）；Windows 下 CREATE_NO_WINDOW 防黑框、
CREATE_NEW_PROCESS_GROUP 使 CTRL_BREAK 只投递给实例进程组。
"""
from __future__ import annotations

import os
import re
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
from collections import deque
from pathlib import Path

# Windows 作业对象：实例进程并入 Core 的 job（KILL_ON_JOB_CLOSE），
# Core 无论优雅退出还是被强杀/崩溃，系统都会回收整棵实例进程树。
# 优雅退出另有 lifespan 钩子先行 stop()，这里防的是硬死亡。
if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes

    class _IO_COUNTERS(ctypes.Structure):
        _fields_ = [
            (name, ctypes.c_uint64)
            for name in (
                "ReadOperationCount", "WriteOperationCount", "OtherOperationCount",
                "ReadTransferCount", "WriteTransferCount", "OtherTransferCount",
            )
        ]

    class _JOB_EXT_LIMITS(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_int64),
            ("PerJobUserTimeLimit", ctypes.c_int64),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
            ("IoInfo", _IO_COUNTERS),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
    _JobObjectExtendedLimitInformation = 9

    def _new_kill_on_close_job() -> int:
        """返回作业句柄；失败返回 0（停止路径仍有 taskkill 兜底，不致命）。"""
        k32 = ctypes.windll.kernel32
        job = k32.CreateJobObjectW(None, None)
        if not job:
            return 0
        limits = _JOB_EXT_LIMITS()
        limits.LimitFlags = _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not k32.SetInformationJobObject(
            job, _JobObjectExtendedLimitInformation, ctypes.byref(limits), ctypes.sizeof(limits)
        ):
            k32.CloseHandle(job)
            return 0
        return job

    def _assign_to_job(job: int, pid: int) -> bool:
        k32 = ctypes.windll.kernel32
        PROCESS_SET_QUOTA = 0x0100
        PROCESS_TERMINATE = 0x0001
        handle = k32.OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, False, pid)
        if not handle:
            return False
        try:
            return bool(k32.AssignProcessToJobObject(job, handle))
        finally:
            k32.CloseHandle(handle)

# 关键事件识别（PLAN §2）：识别结果只追加日志，不做静默动作（OOM 自愈在 M1.2）
_EVENT_PATTERNS = [
    ("OOM", re.compile(r"CUDA out of memory|torch\.OutOfMemoryError", re.I)),
    ("崩溃", re.compile(r"Traceback")),
    ("完成", re.compile(r"Prompt executed in")),
    ("开始", re.compile(r"got prompt")),
]

_HEALTH_TIMEOUT_S = 120


def free_port(start: int = 8188, end: int = 8388) -> int:
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("8188 起找不到空闲端口")


class InstanceManager:
    def __init__(self) -> None:
        self.proc: subprocess.Popen[str] | None = None
        self.port: int | None = None
        self.status = "stopped"  # starting/running/stopping/stopped/failed
        self.exit_code: int | None = None
        self._stopping = False
        self._log: deque[str] = deque(maxlen=2000)
        # RLock：start/stop 在持锁期间要写日志，普通 Lock 会自死锁
        self._lock = threading.RLock()
        self._job = _new_kill_on_close_job() if sys.platform == "win32" else 0

    @property
    def running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def start(self, path: Path, python_cmd: str) -> int:
        with self._lock:
            if self.running:
                raise RuntimeError("实例已在运行")
            port = free_port()
            flags = 0
            if sys.platform == "win32":
                flags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
            self.proc = subprocess.Popen(
                [python_cmd, "main.py", "--port", str(port), "--listen", "127.0.0.1"],
                cwd=str(path),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
                creationflags=flags,
            )
            self.port = port
            self.exit_code = None
            self.status = "starting"
            self._stopping = False
            if self._job and not _assign_to_job(self._job, self.proc.pid):
                self._append("[launcher] 作业对象绑定失败：Core 崩溃时实例进程可能残留")
            self._append(f"[launcher] 已启动 PID {self.proc.pid} · 端口 {port} · 健康检查中（最长 {_HEALTH_TIMEOUT_S}s）")

        threading.Thread(target=self._pump_logs, daemon=True).start()
        threading.Thread(target=self._wait_exit, daemon=True).start()
        threading.Thread(target=self._wait_healthy, daemon=True).start()
        return port

    def stop(self) -> None:
        with self._lock:
            if not self.running or self.proc is None:
                raise RuntimeError("实例未在运行")
            if self._stopping:
                return  # 停止流程已在进行：幂等返回，不重复投递信号/写日志
            self._stopping = True
            proc = self.proc
            self.status = "stopping"
            self._append("[launcher] 收到停止指令")
        try:
            if sys.platform == "win32":
                # CREATE_NO_WINDOW 的实例有独立控制台，CTRL_BREAK 送不到时会立刻
                # 报错/无效——所以优雅路径只等 1s，没死立即 taskkill，不干等超时
                os.kill(proc.pid, signal.CTRL_BREAK_EVENT)
            else:
                proc.terminate()
        except OSError:
            pass
        try:
            proc.wait(timeout=1)
        except subprocess.TimeoutExpired:
            # taskkill 同样走 argv 数组，绝不拼 shell 字符串（AGENTS.md）
            subprocess.run(
                ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                raise RuntimeError("实例进程无法终止") from None

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "running": self.running,
                "status": self.status,
                "port": self.port,
                "pid": self.proc.pid if self.proc else None,
                "exitCode": self.exit_code,
            }

    def logs(self) -> list[str]:
        with self._lock:
            return list(self._log)

    def _append(self, line: str) -> None:
        with self._lock:
            self._log.append(line)

    def _pump_logs(self) -> None:
        assert self.proc and self.proc.stdout
        for raw in self.proc.stdout:
            line = raw.rstrip()
            if not line:
                continue
            self._append(line)
            for name, pattern in _EVENT_PATTERNS:
                if pattern.search(line):
                    self._append(f"[event] {name}")
                    break

    def _wait_exit(self) -> None:
        assert self.proc
        code = self.proc.wait()
        with self._lock:
            self.exit_code = code
            self.status = "failed" if self.status == "starting" else "stopped"
            self._stopping = False
            self._append(f"[launcher] 实例进程退出，exit code {code}")

    def _wait_healthy(self) -> None:
        assert self.port is not None
        url = f"http://127.0.0.1:{self.port}/system_stats"
        deadline = time.monotonic() + _HEALTH_TIMEOUT_S
        while time.monotonic() < deadline:
            if not self.running:
                return  # 退出由 _wait_exit 收尾
            try:
                with urllib.request.urlopen(url, timeout=2) as resp:
                    if resp.status == 200:
                        with self._lock:
                            if self.status == "starting":
                                self.status = "running"
                                self._append(f"[launcher] 健康检查通过 · http://127.0.0.1:{self.port}")
                        return
            except OSError:
                pass
            time.sleep(1)
        with self._lock:
            if self.status == "starting":
                self.status = "failed"
                self._append("[launcher] 健康检查超时：120s 内 /system_stats 未就绪")
