export interface IActionProvider {
    getActions(arg: any): any;
    registerCommands(): void;
}