import fs from "fs";
import path from "path";

import * as esbuild from "esbuild";

const SRC_DIR_NAME = ".";
const BUILD_DIR_NAME = "build";
const ENTRY_POINT_DIR_NAME = ".";
const ENTRY_POINT_NAME = "main.ts";

const ROOT_PATH = process.cwd();
const ROOT_FOLDER_NAME = "langchain-genai-example";
const SRC_PATH = path.resolve(ROOT_PATH, SRC_DIR_NAME);
const ENTRY_POINT_PATH = path.resolve(
  SRC_PATH,
  ENTRY_POINT_DIR_NAME,
  ENTRY_POINT_NAME,
);
const BUILD_PATH = path.resolve(ROOT_PATH, BUILD_DIR_NAME);

const _rootPathParts = ROOT_PATH.split("/");
if (_rootPathParts[_rootPathParts.length - 1] !== ROOT_FOLDER_NAME)
  throw new Error(
    `build.js should be executed in /${ROOT_FOLDER_NAME} directory`,
  );

const buildOptions = {
  entryPoints: [ENTRY_POINT_PATH],
  outdir: BUILD_PATH,
  bundle: true,
  minify: true,
  platform: "node",
  format: "cjs",
};

const start = Date.now();

await esbuild
  .build(buildOptions)
  .then(() => {
    const end = Date.now();
    console.log("Total build time: %d(ms)", end - start);
  })
  .catch((err) => console.error("Error when build:", err.message));
