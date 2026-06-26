import argparse
import json
from pathlib import Path
from typing import List

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
DATA_FILE = Path("tried.json")


class Code(BaseModel):
    code: str
    result: str = ""


def read_codes():
    if not DATA_FILE.exists():
        return []

    with DATA_FILE.open() as f:
        return json.load(f)


def write_codes(codes):
    with DATA_FILE.open("w") as f:
        json.dump(codes, f, indent=2)
        f.write("\n")


def upsert_code(codes, code):
    return [item for item in codes if item.get("code") != code["code"]] + [code]


@app.get("/")
def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/codes")
def get_codes():
    return read_codes()


@app.post("/codes")
def add_code(code: Code):
    data = read_codes()
    data = upsert_code(data, code.model_dump())
    write_codes(data)
    return {"ok": True}


@app.post("/codes/import")
def import_codes(codes: List[Code]):
    data = read_codes()
    imported = [code.model_dump() for code in codes]
    for code in imported:
        data = upsert_code(data, code)
    write_codes(data)
    return {"ok": True, "imported": len(imported)}


def main():
    import uvicorn

    parser = argparse.ArgumentParser(
        prog="codes",
        description="Run the PIN Finder service.",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host/IP address to listen on. Defaults to 127.0.0.1.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8009,
        help="Port to listen on. Defaults to 8009.",
    )
    args = parser.parse_args()

    uvicorn.run("codes:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
