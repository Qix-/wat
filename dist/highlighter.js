
"use strict";

/**
 * Module dependencies.
 */

var _ = require('lodash');
var chalk = require('chalk');
var fs = require('fs');
var hljs = require('highlight.js');

/**
 * Expose a function that passes in a Vantage
 * object and options.
 */

var preference = 'default';

var configPath = './../config/highlight/' + preference + '.json';
var config = undefined;

try {
  config = require(configPath);
} catch (e) {
  console.log('Dir Name:', __dirname);
  console.log('Base:', __base);
  console.log('Full Path:', configPath);
  console.log(e.stack);
}

var mapping = {};

for (var lang in config) {
  mapping[lang] = mapping[lang] || {};
  var ctr = 0;
  for (var item in config[lang]) {
    ctr++;
    if (lang === 'markdown') {
      mapping[lang][config[lang][item] + ctr] = new RegExp("\<md-" + item + "\>(.*?)\<\/md\>", "g");
    } else {
      mapping[lang][config[lang][item] + ctr] = new RegExp("\<span class=\"hljs-" + item + "\"\>(.*?)\<\/span\>", "g");
    }
  }
}

module.exports = function (data, lang, options) {

  var fallback = !mapping[lang] ? 'default' : void 0;
  if (!mapping[lang]) {
    //lang = 'default';
    //throw new Error(`${lang} is not a supported highlighting language.`);
  }

  var hl = undefined;
  if (lang === 'markdown') {
    hl = module.exports.unescape(data);
  } else {
    hl = hljs.highlight(lang, data);
    hl = hl.value;
  }

  var mappingLang = fallback || lang;

  for (var color in mapping[mappingLang]) {
    var clr = String(color).replace(/[0-9]/g, '');
    hl = hl.replace(mapping[mappingLang][color], chalk[clr]('$1'));
  }

  if (lang !== 'markdown') {
    hl = module.exports.unescape(hl);
  }

  return hl;
};

_.extend(module.exports, {

  unescape: function unescape(data) {
    data = data.replace(/&lt;/g, '<');
    data = data.replace(/&gt;/g, '>');
    data = data.replace(/&apos;/g, '\'');
    data = data.replace(/&quot;/g, '"');
    data = data.replace(/&amp;/g, '&');
    data = data.replace(/&#39;/g, '\'');
    return data;
  }

});