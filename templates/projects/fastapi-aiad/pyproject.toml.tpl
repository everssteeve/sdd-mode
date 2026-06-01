[project]
name = "{{name}}"
version = "0.1.0"
description = "{{description}}"
readme = "README.md"
requires-python = ">=3.11"
license = { text = "{{license}}" }
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "pydantic>=2.9",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "httpx>=0.28",
    "ruff>=0.7",
    "black>=24.10",
]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.black]
line-length = 100
target-version = ["py311"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
