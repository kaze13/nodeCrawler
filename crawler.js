var request = require('request');
var cheerio = require('cheerio');
var async = require('async');
var db = require('mysql');
var util = require('./utils.js');
var config = require('./configLoader.js');

config.load(__dirname + '/config.json');

var Crawler = function() {
    var self = this;
    this.conn = db.createConnection(config.get('db'));
    this.indexed = 0;
    this.baseSite = config.get('baseSite');
    this._url = this.baseSite;
    this.url = this.baseSite;

    this.crawl = function(cb) {
      this.conn.query('SELECT * FROM `queue` LIMIT 0,1', function(e, result) {
        self.url = result.length > 0 ? result[0].url : self.baseSite;
        request(self.url, function(e, res, body) {
          if(result.length > 0) {
            self.conn.query('DELETE FROM `queue` WHERE `id` = ?', [result[0].id], function() {
              cb();
            });
          }
          else {
            cb();
          }

          if(!e && res.statusCode === 200) {
            self.getInfo(body, result.length > 0 ? result[0].from : '');
          }
          else {
            console.log('Error requesting page %s', self.url);
          }
          self._url = self.url;
        });
      });
    };

    this.getInfo = function(html, from) {
      var $ = cheerio.load(html);
      var question = {
        id: $('#zh-single-question-page').data('urltoken'),
        title: $('#zh-question-title').text().trim(),
        content: $('#zh-question-detail').text()
      };

      var answers = [];
      $('.zm-item-answer').each(function() {
          var answer = [
            $(this).data('aid'),
            $(this).find('.zm-item-answer-author-wrap').children().eq(1).text(),
            parseInt($(this).find('.count').text()),
            $(this).find('.zm-editable-content').text()
          ];
          answers.push(answer);
        }
      );
      var title = $('head title').text();
      var keywords = $('head meta[name=keywords]').attr('content');
      var desc = $('head meta[name=description]').attr('content');
      var links = $('#zh-question-related-questions').find('a');
      console.log('Crawling "%s" | %s', title, this.url);

      var sqls = links.map(function() {
        var href = $(this).attr('href');
        if(href && href != self._url && !(/^#(\w)+/.test(href)) && !util.imageRegexp.test(href)) {
          if(util.isExternal(href)) {
            return 'INSERT INTO `queue` SET `id` = \'' + util.id() + '\', `url` = ' + self.conn.escape(href) + ', `from` = ' + self.conn.escape(from);
          }
          else {
            return 'INSERT INTO `queue` SET `id` = \'' + util.id() + '\', `url` = ' + self.conn.escape(util.resolveZhiHuRelativeURL(href, self._url)) + ', `from` = ' + self.conn.escape(from);
          }
        }
        return undefined;
      }).filter(function() {
        return !!this;
      }).toArray();


      async.map(sqls
        , this.conn.query.bind(this.conn), function(e) {
          if(e) {
            console.log('Error writing queue.');
            console.log(e);
          }
        });

      //save answers
      var sql = "INSERT INTO answer (id, author, vote, content) VALUES ?";

      this.conn.query(sql, [answers], function(err) {
        if(err) {
          console.log('Error recording answer %s', self.url);
          console.log(err);
        }
        else {
          console.log('Successfully recording answer %s', self.url);
        }
      });


      //save question
      this.conn.query('INSERT INTO `question` SET ?', {
        id: question.id,
        title:question.title,
        content:question.content
      }, function(e) {
        if(e) {
          console.log('Error recording question %s', self.url);
          console.log(e);
        }
        else {
          console.log('Successfully recording question %s', self.url);
          self.indexed++;
        }
      });
    };
  }
  ;

module.exports = Crawler;
