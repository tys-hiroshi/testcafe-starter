import { PathLike, writeFileSync } from "fs";
import { EOL } from "os";
import { ensureDirectoryStructureExists } from "../../tools/fs/ensure-directory-structure-exists";
import { getExportedFunctionsIn } from "../../tools/fs/get-exported-functions-in";
import { getFileName } from "../../tools/fs/get-filename";
import { getFilePathWithoutExtension } from "../../tools/fs/get-filepath-without-extension";
import { getFuncNameFrom } from "../../tools/fs/get-func-name-from-file-name";
import { getJsDocCommentsOf } from "../../tools/fs/get-jsdoc-of-function";
import { getRelativePathOf } from "../../tools/fs/get-relative-path-from";
import { slash } from "../../tools/fs/slash";
import { surround } from "../../tools/string/surround-with-quote";
import { upperCaseFirstLetter } from "../../tools/string/upper-case-first-letter";
import { config } from "../config";

let exportIndex: number = -1;
function nextIndex() {
  exportIndex += 1;
  return exportIndex;
}
export const createStepsMapping = (path: PathLike) => {
  ensureDirectoryStructureExists(path.toString());
  writeFileSync(path, "importing steps and creating given/when/then mappings...");
  return {
    from: (stepFiles: string[]): void => {
      const lines: string[] = [];
      lines.push(`// this file was auto-generated by '${getRelativePathOf(__filename).from(config.stepsMappingFile)}'`);
      lines.push(...createImports());
      lines.push("");
      lines.push(...createInterfaces());
      lines.push(...createStepMappingsFrom(stepFiles).forStep("given"));
      lines.push(...createStepMappingsFrom(stepFiles).forStep("when"));
      lines.push(...createStepMappingsFrom(stepFiles).forStep("then"));
      lines.push(...createStepMappingsFrom(stepFiles).forStep("but"));
      lines.push("");
      writeFileSync(path, lines.join(EOL));
    },
  };
};

function createInterfaces(): string[] {
  const lines = [];
  lines.push("export interface IStepMappings {");
  lines.push(`${config.tab}[index: string]: (stepname: string) => Promise<any>;`);
  lines.push("}");
  return lines;
}

function createImports(): string[] {
  const stepsBarrelRelativePath = getRelativePathOf(
    config.stepsBarrelFile,
  ).from(config.stepsMappingFile);
  const lines: string[] = [];
  lines.push("// tslint:disable:max-line-length");
  lines.push(
    // tslint:disable-next-line:max-line-length
    `import * as step from ${config.quoteMark}${slash(getFilePathWithoutExtension(stepsBarrelRelativePath))}${config.quoteMark};`,
  );
  return lines;
}

export interface IStepMapping {
  stepSentence: string;
  stepFunc: string;
}

function createStepMappingsFrom(stepFiles: string[]) {
  return {
    forStep: (step: string): string[] => {
      const lines: string[] = [];
      const stepMappings = getStepMappingsFrom(stepFiles)
        .forStep(step)
        .sort(((a, b) => a.stepSentence.localeCompare(b.stepSentence)));

      if (stepMappings.length === 0) {
        lines.push(`export const ${step}StepMappings = {};`);
        lines.push(
          // tslint:disable-next-line:max-line-length
          `export type ${upperCaseFirstLetter(step)}Step = keyof typeof ${step}StepMappings;`,
        );
        return lines;
      }

      lines.push("// tslint:disable:object-literal-sort-keys");
      lines.push(`export const ${step}StepMappings = {`);
      stepMappings
          .map((stepMapping) => {
        lines.push(
          // tslint:disable-next-line:max-line-length
          `${config.tab}${surround(stepMapping.stepSentence).with(config.quoteMark)}: step.${stepMapping.stepFunc},`,
        );
      });
      lines.push("};");
      lines.push(
        // tslint:disable-next-line:max-line-length
        `export type ${upperCaseFirstLetter(step)}Step = keyof typeof ${step}StepMappings;`,
      );
      return lines;
    },
  };
}

function getStepMappingsFrom(stepFiles: string[]) {
  return {
    forStep:  (step: string): IStepMapping[]  =>   {
      const results: IStepMapping[] = [];
      stepFiles.map((filePath) => {
      const fileName = getFileName(filePath) || `defaultStep${nextIndex()}`;
      const defaultExportName = getFuncNameFrom(fileName);
      getExportedFunctionsIn(filePath).map((funcInfo) => {
        return getJsDocCommentsOf(funcInfo)
          .filter((comment) => comment.includes(`@${step}`))
          .map((comment: string) => {
            const firstIndex = comment.indexOf("(") + 2;
            const lastIndex = comment.lastIndexOf(")") - 1;
            const stepSentence = comment.substring(firstIndex, lastIndex);
            const stepFunc =
              funcInfo.functionName === "default"
                ? defaultExportName
                : funcInfo.functionName;
            return { stepSentence, stepFunc };
          })
          .map((stepMapping: IStepMapping) => results.push(stepMapping));
        });
      });
      return results;
    },
  };

}
