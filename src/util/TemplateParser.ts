const YAML = require("yaml-cfn");

export class TemplateParser {

    static isJson: boolean;
    static parse(text: string) {
        let template = null;
        try {
            template = JSON.parse(text);
            this.isJson = true;
        } catch (err) {
            try {
                template = YAML.yamlParse(text);
                this.isJson = false;
            } catch (err) { console.log(err); }
        }
        return template;
    }
}