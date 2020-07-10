const YAML = require("yaml-cfn");

export class TemplateParser {

    static parse(text: string) {
        let template = null;
        try {
            template = JSON.parse(text);
        } catch (err) {
            try {
                template = YAML.yamlParse(text);
            } catch (err) { console.log(err); }
        }
        return template;
    }
}