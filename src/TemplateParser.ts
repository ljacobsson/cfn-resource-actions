const YAML = require("yaml-cfn");

export class TemplateParser {

    parse(text: string) {
        let template = null;
        try {
            template = JSON.parse(text);
        } catch (err) {  console.log(err);}
        try {
            template = YAML.yamlParse(text);
        } catch (err) { console.log(err);}
        if (template) {
            const list = [];
            for (const key of Object.keys(template.Resources)) {
                list.push({
                    name: key,
                    type: template.Resources[key].Type,
                });
            }
            return list;
        }
        return null;
    }
}
