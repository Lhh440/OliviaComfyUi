"""硬件采样（PLAN §3.1）：NVML 500ms + psutil。

口径纪律（ADR-0007/AGENTS.md）：采不到的字段保持 null，由前端显示「不可用」，
绝不填 0 或估算值。首块 GPU（index 0）即看板对象，多卡在 M1.2 扩展。
"""
from __future__ import annotations

import threading
import time
from collections import deque


def _null_gpu() -> dict:
    return {
        "name": None, "driver": None, "utilization": None,
        "vramUsedGb": None, "vramTotalGb": None,
        "temperatureC": None, "fanPercent": None,
        "powerW": None, "powerLimitW": None,
    }


class HardwareMonitor:
    def __init__(self, interval: float = 0.5) -> None:
        self.interval = interval
        self.latest: dict = {"ts": 0, "gpu": _null_gpu(), "system": _null_system()}
        self.history: deque[dict] = deque(maxlen=1200)  # 10 分钟 @500ms
        self._nvml = None
        self._handle = None
        self._init_nvml()
        threading.Thread(target=self._loop, daemon=True).start()

    def _init_nvml(self) -> None:
        try:
            import pynvml

            pynvml.nvmlInit()
            self._nvml = pynvml
            self._handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        except Exception:
            # 无 N 卡 / 驱动过旧 / pynvml 初始化失败：全字段 null，前端显示「不可用」
            self._nvml = None
            self._handle = None

    @property
    def nvml_available(self) -> bool:
        return self._nvml is not None and self._handle is not None

    def driver_version(self) -> str | None:
        if not self.nvml_available:
            return None
        try:
            v = self._nvml.nvmlSystemGetDriverVersion()
            return v.decode() if isinstance(v, bytes) else str(v)
        except Exception:
            return None

    def gpu_name(self) -> str | None:
        if not self.nvml_available:
            return None
        try:
            n = self._nvml.nvmlDeviceGetName(self._handle)
            return n.decode() if isinstance(n, bytes) else str(n)
        except Exception:
            return None

    def sample(self) -> dict:
        gpu = _null_gpu()
        if self.nvml_available:
            n = self._nvml
            try:
                util = n.nvmlDeviceGetUtilizationRates(self._handle)
                mem = n.nvmlDeviceGetMemoryInfo(self._handle)
                gpu.update(
                    {
                        "name": self.gpu_name(),
                        "driver": self.driver_version(),
                        "utilization": int(util.gpu),
                        "vramUsedGb": round(mem.used / 1024**3, 2),
                        "vramTotalGb": round(mem.total / 1024**3, 2),
                        "temperatureC": int(
                            n.nvmlDeviceGetTemperature(self._handle, n.NVML_TEMPERATURE_GPU)
                        ),
                        "fanPercent": int(n.nvmlDeviceGetFanSpeed(self._handle)),
                        "powerW": round(n.nvmlDeviceGetPowerUsage(self._handle) / 1000, 1),
                        "powerLimitW": round(
                            n.nvmlDeviceGetEnforcedPowerLimit(self._handle) / 1000, 1
                        ),
                    }
                )
            except Exception:
                pass  # 单次采样失败：本帧保持 null

        import psutil

        vm = psutil.virtual_memory()
        sample = {
            "ts": int(time.time() * 1000),
            "gpu": gpu,
            "system": {
                "cpuPercent": psutil.cpu_percent(interval=None),
                "ramUsedGb": round((vm.total - vm.available) / 1024**3, 2),
                "ramTotalGb": round(vm.total / 1024**3, 2),
            },
        }
        self.latest = sample
        self.history.append(sample)
        return sample

    def _loop(self) -> None:
        import psutil

        psutil.cpu_percent(interval=None)  # 建立基线，后续调用才是真实增量
        while True:
            try:
                self.sample()
            except Exception:
                pass  # 采样线程绝不允许带崩服务
            time.sleep(self.interval)


def _null_system() -> dict:
    return {"cpuPercent": None, "ramUsedGb": None, "ramTotalGb": None}
