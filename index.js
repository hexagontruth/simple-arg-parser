module.exports = (...params) => {
  return new Argparser(...params);
}

class ArgError extends Error {
  constructor(...params) {
    super(...params);
  }
}

class Argparser {
  constructor(...params) {
    let config = {}, opts = [];
    while (params.length) {
      const param = params.shift();
      if (Array.isArray(param)) {
        opts = opts.concat(param);
      }
      else if (typeof param == 'object') {
        Object.assign(config, param);
      }
    }
    this.config = Object.assign({}, config);
    this.flagMap = {};
    this.defaults = {};
    this.stringOpts = [];
    this.required = [];
    this.opts = [];
    this.add(opts);
  }

  add(opts=[]) {
    this.opts = this.opts.concat(opts.map((unformatted) => {
      const opt = { ...unformatted };
      opt.name = Array.isArray(opt.name) ? opt.name : [opt.name];
      opt.key = opt.name[0];
      opt.help = opt.help || '';
      opt.flag = !(opt.flag === false);
      opt.type = opt.type || opt.flag && 'boolean' || 'string';
      opt.takesValue = opt.flag && ['string', 'number'].includes(opt.type);
      opt.required = !!opt.required;
      if (opt.required) {
        this.required.push(opt.key);
      }
      if (opt.default) {
        this.defaults[opt.key] = opt.default;
      }
      if (opt.flag) {
        opt.name.forEach((e) => this.flagMap[e] = opt);
      }
      else {
        this.stringOpts.push(opt);
      }
      return opt;
    }));
    return this;
  }

  set(config) {
    this.config = Object.assign(this.config, config);
    return this;
  }
  
  name(str) {
    this.config.name = str;
    return this;
  }

  description(str) {
    this.config.description = str;
    return this;
  }

  usage(str) {
    this.config.usage = str;
    return this;
  }

  help(action=() => this.displayHelp()) {
    this.add([
      {
        name: ['help', 'h'],
        help: 'Display help',
        action: action,
      },
    ]);
    return this;
  }

  version(version, action=() => this.displayVersion()) {
    this.config.version = version;
    this.add([
      {
        name: ['version', 'v'],
        help: 'Display version',
        action: action,
      },
    ]);
    return this;
  }

  getHelp() {
    const { config, opts } = this;
    const rows = [];
    config.name && rows.push(config.name);
    config.description && rows.push(config.description);
    config.usage && rows.push(`Usage: ${config.usage}`);

    let maxarg = 0, maxhelp = 0;
    const argrows = opts.map((opt) => {
      let str = '';
      if (!opt.flag) {
        str += `[${opt.key}]`;
        if (opt.default) {
          str += `=${opt.default}`;
        }
      }
      else {
        str += opt.name.map((name) => {
          if (opt.takesValue) {
            return name.length > 1 ? `--${name}=[${opt.type}]` : `-${name} [${opt.type}]`;
          }
          else {
            return name.length > 1 ? `--${name}` : `-${name}`;
          }
        }).join(' ');
      }

      maxarg = Math.max(maxarg, str.length);
      maxhelp = Math.max(maxhelp, opt.help.length);

      let type = (this.config.showBoolean || opt.type != 'boolean' || !opt.flag) && `[${opt.type}]` || '';
      if (opt.required) {
        type += '*';
      }
      return [str, opt.help, type];
    });

    rows.length && rows.push('');
    rows.push(...argrows.map((row) => {
      const padded = row.slice();
      padded[0] = padded[0].padStart(maxarg + 2);
      padded[1] = padded[1].padEnd(maxhelp);
      return padded.join('  ');
    }));
    return rows.join('\n');
  }

  displayHelp() {
    console.log(this.getHelp());
    process.exit();
  }

  displayVersion() {
    console.log(this.config.version);
    process.exit();
  }

  parse(...params) {
    this.add(params.pop() || []);
    const args = params.pop() || process.argv.slice(2);
    const { flagMap, stringOpts } = this;

    let config = {};

    let i = 0;
    while (args.length) {
      if ((i++) > 255) {
        // I don't know how this can be triggered but I'm putting it in to be safe
        throw new ArgError('Too much recursion');
      }
      const rawArg = args.shift();
      const match = rawArg.match(/^(\-*)(.*?)(=.*)?$/);

      const flag = !!match[1];
      const long = match[1] == '--';
      const arg = match[2];
      const data = flag && arg ? flagMap[arg] : stringOpts.shift();

      // Set value

      let value;
      // Special case of hyphen-only argument
      if (flag && !arg) {
        if (data) {
          value = this.defaults[data.key];
          if (value === undefined) {
            throw new ArgError(`Option ${data.key} does not have a default value!`);
          }
        }
        else {
          continue;
        }
      }
      // Is long-form arg
      else if (long) {
        value = match[3]?.replace('=', '');
        // Empty strings on booleans should be preserved and evaluated false below
        value = value != null ? value : data?.type == 'boolean' && true || '';
      }
      else if (flag) {
        // Grab next argument for short flags if type is string or number
        if (data?.takesValue) {
          value = args.shift();
        }
        // Boolean shorts are set to true
        else if (data?.type == 'boolean') {
          value = true;
        }
        // Shorts without data are left without a value for the moment
      }
      // Non-flag arguments are their own value
      else {
        value = arg;
      }

      // Cast value

      if (data?.type == 'boolean') {
        if (typeof value == 'string') {
          value = Number(value) > 0 || ['true', 't'].includes(value.toLowerCase());
        }
        else {
          value = !!value;
        }
      }
      if (data?.type == 'string') {
        value = value != null ? value : 'null';
        value = value.toString();
      }
      else if (data?.type == 'number') {
        value = value || 0;
        value = Number(value);
        if (isNaN(value)) {
          throw new ArgError(`Value for ${arg} is not a number`)
        }
      }

      // Assign value

      if (flag) {
        // Short and long flags with data
        if (data) {
          config[data.key] = value;
          data.action && data.action(value);
        }
        // Short flag groups are broken up
        else if (!long && arg.length > 1) {
          const shorts = [...arg].map((e) => `-${e}`);
          args.unshift(...shorts);
        }
        // Undefined non-grouped flags throw an error
        else {
          throw new ArgError(`Flag ${rawArg} is not defined`);
        }
      }
      else {
        const key = data?.key;
        // Set to defined field value if exists
        if (key) {
          config[key] = value;
        }
        // Otherwise put in `other` array as unformatted string
        else {
          config.other = config.other || [];
          config.other.push(arg);
        }
      }
    }

    // Assign remaining defaults

    config = Object.assign(this.defaults, config);

    // Check for required values

    const missing = this.required.filter((e) => config[e] === undefined);
    if (missing.length) {
      throw new ArgError(`Missing required arguments: ${missing.join(', ')}`);
    }

    return config;
  }
}