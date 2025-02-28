
"use strict";

/**
 * Module dependencies.
 */

const _ = require('lodash');
const walk = require('walk');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const chalk = require('chalk')

const indexer = {

  // The JSON of the index.
  _index: void 0,

  // Last time the index was
  // pulled from online.
  _indexLastUpdate: void 0,

  // Always wait at least an hour since
  // the last index.json was pulled 
  // before trying again, unless the
  // update is forced.
  _updateInterval: 3600000,

  // When building your docs with gulp,
  // you sometimes don't want Wat to 
  // be smart and override your index.
  updateRemotely: true,

  /**
  * Thump, thump... It's alive!
  *
  * @param {Object} options
  * @return {Indexer}
  * @api public
  */

  init(options) {
    const self = this;
    options = options || {}
    if (options.clerk) {
      indexer.clerk = options.clerk;
    }
    if (options.updateRemotely === false) {
      this.updateRemotely = false;
    } else {
      setInterval(this.update, 3600000);
      setTimeout(function() {
        self.update();
      }, 6000);
    }
    return this;
  },

  /**
  * Assembles the index based on the ./docs
  * folder. This needs to be called manually,
  * and is used by Gulp in rebuilding the
  * the index after doc work.
  *
  * @param {Function} callback
  * @api public
  */

  build(callback) {
    callback = callback || {}
    let index = {}
    const walker = walk.walk(path.normalize(__dirname + '/../docs/'), {});
    walker.on('file', function(root, fileStats, next){
      const parts = String(path.normalize(root)).split('docs/');
      if (parts[1] === undefined) {
        console.log('Invalid path passed into wat.indexer.build: ' + root);
        next();
        return;
      }
      if (String(fileStats.name).indexOf('.json') > -1) {
        next();
        return;
      }
      const file = parts[1];
      const dirs = String(path.normalize(file)).split('/');
      dirs.push(fileStats.name);
      let remainder = _.clone(dirs);
      function build(idx, arr) {
        let item = String(arr.shift());
        if (item.indexOf('.md') > -1) {
          let split = item.split('.');
          split.pop();
          let last = split[split.length - 1];
          let special = (split.length > 1 && ['install', 'detail'].indexOf(last) > -1);
          if (special) {
            split.pop();
          }
          let type = (special) ? last : 'basic';
          
          let filename = split.join('.');
          idx[filename] = idx[filename] || {}
          idx[filename]['__' + type] = fileStats.size;
        } else {
          idx[item] = idx[item] || {}
        }
        if (arr.length > 0) {
          idx[item] = build(idx[item], arr);
        } 
        return idx;
      }
      index = build(index, remainder);
      next();
    });

    walker.on('errors', function(root, nodeStatsArray, next){
      console.log(root, nodeStatsArray)
      throw new Error(root);
    });

    walker.on('end', function(){
      callback(index);
    });
  },

  /**
  * Writes an index JSON to the disk.
  *
  * @param {Object} json
  * @api public
  */

  write(json) {
    let index = JSON.stringify(json, null, '');
    let result = fs.writeFileSync(__dirname + '/../config/index.json', JSON.stringify(json, null, ''));
    this._index = json;
    indexer.clerk.config.setLocal("docIndexLastWrite", new Date());
    indexer.clerk.config.setLocal("docIndexSize", String(index).length);
    return result;
  },

  /**
  * Retrieves the index.json as it 
  * sees fit.
  *
  * @return {Object} json
  * @api public
  */

  index() {
    if (!this._index) {
      try {
        let index = fs.readFileSync(__dirname + '/../config/index.json', { encoding: 'utf-8'});
        let json = JSON.parse(index);
        this._index = json;
      } catch(e) {
        return void 0;
        this._index = void 0;
      }
    }
    return this._index;
  },

  /**
  * Pulls the index.json from the
  * main github doc repo.
  *
  * @param {function} callback
  * @api public
  */

  getRemoteIndex(callback) {
    const self = this;
    self.clerk.fetchRemote(self.clerk.paths.remoteConfigUrl + 'index.json', function(err, data) {
      if (!err) {
        let err2 = false;
        let json;
        try {
          json = JSON.parse(data);
        } catch(e) {
          err2 = true;
          callback("Error parsing remote index json: " + data + ", Error: " + e + ", url: " + self.clerk.paths.remoteConfigUrl + 'index.json');
        }
        if (!err2) {
          callback(void 0, json);
        }
      } else {
        callback(err);
      }
    });
  },

  /**
  * Interval that checks the
  * config.json online to see if the
  * index.json has changed. We go through
  * this hoop as the index.json will eventually
  * be huge, and that would be really messed up
  * to have every wat client on earth 
  * pulling that regardless of updates or
  * not. And github might sue me.
  *
  * If { force: true } is passed in as an
  * option, update regardless of whether or
  * not we think the index change or if it's
  * past curfew.
  *
  * @param {Object} options
  * @api public
  */

  update(options, callback) {
    options = options || {}
    callback = callback || function() {}
    const self = indexer;
    let sinceUpdate;

    // If we can't read the file,
    // assume we just download it newly.
    try {
      const stats = fs.statSync(__dirname + '/../config/index.json');
      sinceUpdate = Math.floor((new Date() - stats.mtime));
    } catch(e) {
      let error = chalk.yellow('\nHmmm. Wat can\'t find any sort of index.\nChecking online. Please wait.\n');
      //console.log(error);
    }

    if (sinceUpdate > self._updateInterval || !sinceUpdate || options.force === true) {
      self.clerk.config.getRemote(function(err, remote){
        if (!err) {
          let local = self.clerk.config.getLocal();
          let localSize = parseFloat(local.docIndexSize || 0);
          let remoteSize = parseFloat(remote.docIndexSize || -1);
          if (localSize !== remoteSize || options.force === true) {
            self.getRemoteIndex(function(err, index) {
              if (err) {
                console.log(err);
              } else {
                self.write(index);
                self.clerk.compareDocs();
                callback(void 0, 'Successfully updated index.');
              }
            });
          }
        } else {
          if (String(err).indexOf('Not Found') > -1) {
            let error = chalk.yellow('\nWat could not locate ' + 
              'the remote config directory and so does not ' + 
              'know where to pull docs from.\nRe-installing ' + 
              'your instance of Wat through NPM should ' + 
              'solve this problem.\n\n') + 
              'Url Attempted: ' + self.clerk.paths.remoteConfigUrl + 'config.json';
            console.log(error);
            throw new Error(err);
          } else {
            if (err.code === 'EAI_AGAIN') {
              let error = chalk.yellow('\n\nEr, Wat\'s having DNS ' + 
                'resolution errors. Are you sure you\'re connected to the internet?');
              console.log(error);
              throw new Error(err);
            } else if (err.code === 'ETIMEDOUT') {
              let error = chalk.yellow('\n\nHmm.. Wat had a connection timeout when trying to ' + 
                'fetch its index. \nHow\'s that internet connection looking?');
              console.log(error);
            } else {
              console.log(chalk.yellow('\nWat had an unexpected error while requesting the remote index:\n'));
              console.log(err);
            }
          }
        }
      });
    }

  },

}

module.exports = indexer;




