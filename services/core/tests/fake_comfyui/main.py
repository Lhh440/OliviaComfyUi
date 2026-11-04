"""端到端验证夹具：最小 ComfyUI 替身。

只实现启动器健康检查与队列探测所需的最小面（/system_stats、/queue），
用于在没有真实 ComfyUI 的机器上验证进程守护全链路。不参与打包分发。
"""
import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        if self.path == "/system_stats":
            body = json.dumps({"system": {"os": "fake"}, "devices": []}).encode()
        elif self.path == "/queue":
            body = json.dumps({"queue_running": [], "queue_pending": []}).encode()
        else:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # 静默：避免污染启动器日志流
        pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8188)
    parser.add_argument("--listen", default="127.0.0.1")
    args = parser.parse_args()
    HTTPServer((args.listen, args.port), Handler).serve_forever()
