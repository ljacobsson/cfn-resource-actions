export class StringUtil {
    static cleanString(str: string): string {
        return str.replace(/\"/g, "").replace(/\:/g, "").replace(/\'/g, "").replace(/\./g, "").replace(/\,/g, "").trim();
    }
    static isJson(str: string) {
        let isJson = true;
        try {
            JSON.parse(str);
        }
        catch (err) {
            isJson = false;
        }
        return isJson;
    }
}


