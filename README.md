# simple-arg-parser

## Purpose

I didn't like any of the existing Node argument parsers so I wrote my own. It suits my needs and behaves as I expect a minimal parser to behave, without unnecessary bloat. YMMV. It supports traditional short and long GNU/POSIX-style flags prefixed with one or two hyphens respectively, as well as standalone string or numeric arguments.

## Basic usage

An extremely minimal example:

```js
const simpleArgParser = require('simple-arg-parser');

const opts = simpleArgParser().parse([ { name: 'flag' } ]);

console.log(opts);
```

This will parse a single possible flag, `--flag`, from the provided arguments, and yields the following behavior:

```
$ yourprogram
{}

$ yourprogram --flag
{ flag: true }
```

A minimal yet illustrative example:

```js
const simpleArgParser = require('simple-arg-parser');

const opts = simpleArgParser()
.help()
.version('1.2.3')
.usage('yourprogram [options] [string]')
.parse(process.argv.slice(2), [
  {
    name: [ 'flag', 'f' ],
    help: 'An optional flag',
  },
  {
    name: [ 'option', 'o' ],
    help: 'Another optional flag'
  },
  {
    name: [ 'optionalString', 's' ],
    type: 'string',
    help: 'An optional string with a flag',
  },
  {
    name: 'string',
    flag: false,
    help: 'An optional standalone string',
  },
]);
```

Adding `help()` and `version()` creates rules for `-h`, `--help`, `-v`, and `--version`.

Running `yourprogram -h` here will print the following and exit:

```
Usage: yourprogram [options] [string]

                              --help -h  Display help                    
                           --version -v  Display version                 
                              --flag -f  An optional flag                
                            --option -o  Another optional flag           
  --optionalString=[string] -s [string]  An optional string with a flag  [string]
                               [string]  An optional standalone string   [string]
```

Running `yourprogram -v` will simply print `1.2.3` and exit.

## Defining options

The `parse()` function takes an optional first argument of an array of arguments to parse, which defaults to `process.argv.slice(2)`, and an array of option definitions with a variety of possible properties:

| Property | Value |
| -------- | ----- |
| `name*` | `string` or array of strings indicating command line flags or field name
| `help` | `string` describing this option for help text generation
| `flag=true` | `boolean` indicating whether this should be parsed as a flag or a named field (i.e. a free-form argument)
| `type=['boolean'\|'string'\|'number']` | `string` indicating data type — defaults to `boolean` for flag fields and `string` otherwise
| `required=false` | `boolean` indicating whether option is required
| `default` | Default value to assign when argument is not provided
| `action` | Optional function to call with evaluated value when argument is passed — only works for flag options, and is called regardless of value

Only `name` is required. By default it defines the flag arguments used to invoke this option, with the first string provided representing the key name that will be assigned to the returned options object. Strings of more than one letter are invoked with two hyphens, those that are single letters are invoked with one. By convention one should typically provide these as in the examples above, as an array of two flags with the long one first.

If `flag` is set to false, only one `name` string is read, as the key for the next argument not prefixed with one or more hyphens. Thus, if one has a required e.g. filename argument, one might use an option object like the following:

```js
const opts = [{
  name: 'filename',
  flag: false,
  required: true,
}];
```

Parsed and printed to the console as in the example above, this will produce the following behavior:

```
$ yourprogram hello.txt
{ filename: 'hello.txt' }

$ yourprogram
ArgError: Missing required arguments: string
...

```

Named options are strings by default, but can be numbers or booleans as well by setting the `type` property. For booleans, the values "t," "true," or any number above zero will be evaluated as `true`, while all others will be evaluated as false. Named options are assigned in the order they are provided.

Any additional non-hyphen-prefixed arguments that do not match named fields will be assigned to an `other` array in the returned configuration object. So e.g.:

```js

parse(
  [ 'arg1', 'arg1' ],
  [ { name: 'field', flag: false } ]
);
> { field: 'arg1', other: [ 'arg2' ] }

```

Some of these option properties will produce weird results when used in combination. And for instance one can define an option that is both required and has a default value, despite the former property having no effect in such a case.

## Argument parsing

Non-boolean flag arguments (i.e. numbers or strings) can be assigned either in `option=[value]` or `-o [value]` format (where `['option', 'o']` is the option name value). Single or double quotes can be used to include spaces, &c., with all the usual shell quote handling rules in effect.

Short options can be chained together such as e.g. `-abc`, where `a`, `b`, and `c` are distinct boolean options. If an option takes a non-boolean argument it should be the final option in such a chain. Otherwise the following letter will be interpretted as the option value, with a prefixed hyphen. So e.g. in the case of `-abc` where, say, `b` takes a string argument, that value will be set to "-c" and the `-c` flag, if it exists, will not be processed. This is usually not desired.

Missing required arguments will throw an error listing all such arguments. Any `number` type argument that evaluates to `NaN` will also throw an error.

Aside from named non-flag fields, which are assigned in the order received (regardless of type), flag arguments can be provided in any order, anywhere in the argument array. If duplicate versions of arguments are provided, the value is set to the last provided value, though e.g. an `action` function call will occur for every instance.

A standalone hyphen (or multiple hyphens) will assign the default value to the next non-flag option. If there is no default value, an error will be thrown. If there are no remaining non-flag options, it will simply be ignored.

So e.g.:

```js
const opts = parse([
  {
    name: 'option',
    flag: false,
    default: 'a string',
  }
]);

console.log(opts);
```

will yield the following:

```sh
$ yourprogram - sometext
{ option: 'a string', other: [ 'sometext' ]}

$ yourprogram sometext
{ option: 'sometext' }
```

Undefined flags will also throw an error.

## Instantiation options and chainable methods

`simpleArgParser()` can be called with a configuration object and an array of options. Additional options can be provided via the `add()` method. So the following are equivalent:

```js
const opts = simpleArgParser().parse([
  {
    name: ['flag', 'f']
  },
  {
    name: 'somethingelse'
  },
]);
```

```js
const opts = simpleArgParser({}, [
  {
    name: ['flag', 'f']
  },
  {
    name: 'somethingelse'
  },
]).parse();
```

```js
const opts = simpleArgParser().add([
  {
    name: ['flag', 'f']
  },
  {
    name: 'somethingelse'
  },
]).parse();
```

The following chainable methods are offered for convenience:

| Method | Description |
|--------|-------------|
|`add(opts)`| Add an array of options
|`set(config)` | Set internal configuration options
|`help()` | Add `-h` and `--help` flags that print formatted help text and exit when provided
|`version(version)` | Add `-v` and `--version` flags that print specified version and exit when provided
|`name(name)` | Set program name for help text
|`description(description)` | Set program description for help text
|`usage(usage)` | Set usage string for help text e.g. "program [options] [filename]," etc.

The configuration object passed to `set()` or `simpleArgParser()` can include the following optional properties:

| Property | Description |
|----------|-------------|
| `name` | Same as above |
| `description` | Same as above |
| `usage` | Same as above |
| `version` | Sets version number as above, but without generating flags |
| `showBoolean` | Optional boolean value that forces display of "[boolean]" in generated help text for regular flag options