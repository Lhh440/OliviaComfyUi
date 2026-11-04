import os

import uvicorn

from .api import create_app


def main() -> None:
    app, port = create_app()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
