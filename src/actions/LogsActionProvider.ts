import { IActionProvider } from "./IActionProvider";
import { Globals } from "../util/Globals";
import AWS = require("aws-sdk");
import { commands, window } from "vscode";

@IActionProvider.register
export class LogsActionProvider {
  async registerCommands(): Promise<void> {}

  public getPhysicalActions() {
    return {
      "AWS::Logs::LogGroup": (arg: any) => {
        return [
          {
            title: `Tail logs`,
            tooltip: "Tail logs",
            command: "cfn-resource-actions.runShellCommand",
            arguments: [
              `aws logs tail ${arg} --follow --region ${AWS.config.region}`,
            ],
          },
        ];
      },
    };
  }

  public getLogicalActions() {
    return null;
  }
}
