declare module 'vdf-parser' {
    /**
     * Parse a VDF string into a JavaScript object
     * @param text VDF text
     * @param types Attempt to automatically convert numbers and booleans to their correct types, defaults to true
     * @returns Parsed object
     */
    export function parse(text: string, types?: boolean): object;

    /**
     * Parse a JavaScript object into a VDF string
     * @param obj The object to stringify
     * @param pretty Add intendation to the resulting text, defaults to false
     * @returns VDF string
     */
    export function stringify(obj: object, pretty?: boolean): string;
}