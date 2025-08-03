import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import path from "path";

export default [{
  files: ["**/*.ts"],
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      project: path.resolve("./tsconfig.json"), 
      tsconfigRootDir: path.resolve("."),
    },
  },
  plugins: {
    "@typescript-eslint": typescriptEslint,
  },
  rules: {
    
    curly: "warn",
    eqeqeq: "warn",
    "no-throw-literal": "warn",
    semi: "warn",
  },
}];
