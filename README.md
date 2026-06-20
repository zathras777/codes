# codes

A tiny FastAPI service for storing code attempts in `tried.json`.

## Why?

An older device we use requires 4 digit PIN codes to enable access to various service options. While we normally don't need them, I ideally need to gain access to one of these submenus but lacking the code and having exhausted all avenues to get it, there is only one way left... A very slow, painful way...

To try and avoid duplicating my effort I needed a simple way to know what code to try and record the results. The results are this repository.

It's unlikely to be useful to anyone else, but who knows and at least this way I have a record of it.

## Install

```sh
python3 -m venv .venv
.venv/bin/python -m pip install .
```

For editable local development:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -e .
```

- `tried.json` will be created as needed.

## Run

```sh
.venv/bin/codes
```

The service starts on <http://127.0.0.1:8009>.

To choose the listen address or port:

```sh
.venv/bin/codes --host 0.0.0.0 --port 8009
```

## API

List codes:

```sh
curl http://127.0.0.1:8009/codes
```

Add a code:

```sh
curl -X POST http://127.0.0.1:8009/codes \
  -H 'content-type: application/json' \
  -d '{"code":"0123","result":"worked"}'
```

## CSV Import

Use the `Import CSV` button in the web UI to bulk add attempted codes. This is mainly to allow for my migration from an earlier recording attempt, but may be useful if existing results are available.

The CSV must have exactly two columns per row:

```csv
code,result
```

The first column is the code. The second column is either `no` for a failed
attempt, or the menu option/name found for a match.

Example:

```csv
0000,no
1234,no
4567,Main Menu
9999,Admin
```

The import does not require a header row. If a header row is included, it will
be imported as data, so omit headers.
