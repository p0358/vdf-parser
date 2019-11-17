# vdf-parser

`vdf-parser` is a simple library that can convert VDF to JSON and vice versa. It is mostly based on [rossengeorgiev/vdf-parser](https://github.com/rossengeorgiev/vdf-parser), but includes some features inspired by [RoyalBingBong/vdfplus](https://github.com/RoyalBingBong/vdfplus), which lacked some features supported by the former...

Format: https://developer.valvesoftware.com/wiki/KeyValues

VDF may contain comments. However, they are not preserved during decoding.

## Features

- Supports unquoted keys and values
- Supports parent keys that appear multiple times by "arrayifying" them
- Supports uppercase characters in keys and values
- Includes TypeScript types

## Methods

```ts
/**
 * Parse a VDF string into a JavaScript object.
 * @param text VDF text
 * @param types Attempt to automatically convert numbers and booleans to their correct types, defaults to true
 */
export function parse(text: string, types?: boolean = true): object;

/**
 * Parse a JavaScript object into a VDF string
 * @param obj The object to stringify
 * @param pretty Add intendation to the resulting text, defaults to false
 */
export function stringify(obj: object, pretty?: boolean = false): string;
```

## Installation

`npm install vdf-parser`