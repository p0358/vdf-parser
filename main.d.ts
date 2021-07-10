declare module 'vdf-parser' {
    interface VDFParseOptions {
        /**
         * Attempt to automatically convert numbers and booleans to their correct types, defaults to true
         */
        types: boolean = true;

        /**
         * Arrayify the values if they appear multiple times.
         * Enabled by default, because Source does support multiple values with the same key (as separate entries).
         * One may want to disable it if they expect a single value and their code is not prepared for different cases.
         * In such case, the existing text value would be replaced with the new one, and existing object patched with the new values.
         */
        arrayify: boolean = true;

        /**
         * Allow empty unquoted values, when a line contains only a key, which is not followed by a value.
         * Does not affect quoted empty values ("").
         * You may set it to false in order to get a more strict parsing, because an empty unquoted value is normally something unexpected and causes a syntax error in other parsers.
         * You may keep it allowed to avoid random errors, in case you suspect your source of the possibility of producing malformed input.
         * Defaults to "warn" to allow, but warn with console.warn when encountered.
         */
        allowEmptyUnquotedValues: boolean | "warn" = "warn";
    }

    interface VDFStringifyOptions {
        /**
         * Add indentation to the resulting text, defaults to false
         */
        pretty: boolean = false;

        /**
         * Indent with the following characters, defaults to a tabulator, requires "pretty" to be set to true
         */
        indent: string = "\t";
    }

    /**
     * Parse a VDF string into a JavaScript object
     * @param text VDF text
     * @param options Parsing options. Accepts a boolean for backwards compatibility ("types" option defaulting to true)
     * @returns Parsed object
     */
    export function parse(text: string, options?: VDFParseOptions | boolean): object;

    /**
     * Parse a JavaScript object into a VDF string
     * @param obj The object to stringify
     * @param options Parsing options. Accepts a boolean for backwards compatibility ("pretty" option defaulting to false)
     * @returns VDF string
     */
    export function stringify(obj: object, options?: VDFStringifyOptions | boolean): string;
}
