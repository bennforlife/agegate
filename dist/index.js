(function (global, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['exports', 'module', './data', './cookies', 'dayjs', 'dayjs/plugin/relativeTime'], factory);
  } else if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
    factory(exports, module, require('./data'), require('./cookies'), require('dayjs'), require('dayjs/plugin/relativeTime'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, mod, global.data, global.cookies, global.dayjs, global.relativeTime);
    global.index = mod.exports;
  }
})(this, function (exports, module, _data, _cookies, _dayjs, _dayjsPluginRelativeTime) {
  'use strict';

  var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

  function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

  var _cookies2 = _interopRequireDefault(_cookies);

  var _dayjs2 = _interopRequireDefault(_dayjs);

  var _relativeTime = _interopRequireDefault(_dayjsPluginRelativeTime);

  var FORM_ELEMENTS = ['year', 'month', 'day', 'country', 'remember'];

  var AgeGate = (function () {
    function AgeGate(opts, cb) {
      _classCallCheck(this, AgeGate);

      this.options = opts;
      this.callback = cb;
      this.isEnabled.data && this.validateData(opts.data);

      // render
      this.isEnabled.countries && this.populate();
      this.options.form.addEventListener('submit', this.submit.bind(this));
    }

    /**
     * Getters & Setters
     */

    _createClass(AgeGate, [{
      key: 'validateData',

      /**
       * Check data structure of supplied data
       *
       * @param {Array} data
       */
      value: function validateData(data) {
        var random = Math.floor(Math.random() * (data.length - 0) + 0);

        // ensure: containing Array and Object keys
        var ok = Array.isArray(data) || data instanceof Array;
        ok = ok && ['code', 'name', 'age'].every(function (k) {
          return data[random].hasOwnProperty(k);
        });

        return ok ? data : this.respond(false, 'Supplied data is invalid');
      }

      /**
       * Add countries to <select> element
       */
    }, {
      key: 'populate',
      value: function populate() {
        var select = this.options.form.querySelector('select');
        select.innerHTML = ''; // assume it's not empty

        // attempt to use user-supplied data
        if (this.isEnabled.data) this.data.forEach(function (country) {
          return select.appendChild(createOption(country));
        });

        // fallback to default data (continent-separated)
        else {
            Object.keys(_data).forEach(function (continent) {
              var group = document.createElement('optgroup');
              group.label = continent;

              // create the <option> for each country
              for (var i = 0; i < _data[continent].length; i++) {
                var country = _data[continent][i];
                group.appendChild(createOption(country));
              }

              select.appendChild(group);
            });
          }

        // create the <option> element
        function createOption(country) {
          var option = document.createElement('option');

          for (var attr in country) {
            option.dataset[attr] = country[attr];
          }
          option.value = country.code;
          option.textContent = country.name;

          return option;
        }
      }

      /**
       * Serialize form data on submit,
       * and pass onto validation
       *
       * @param {Event} e - form submit event
       */
    }, {
      key: 'submit',
      value: function submit(e) {
        e.preventDefault();

        var elements = e.target.elements;

        // create an object from the form data
        this.formData = FORM_ELEMENTS.reduce(function (collection, key) {
          if (!elements[key]) return collection;

          switch (key) {
            case 'remember':
              collection[key] = elements[key].checked;
              break;
            default:
              collection[key] = elements[key].value;
              break;
          }

          return collection;
        }, {});

        this.validateForm(this.formData, elements);
      }

      /**
       * Return number of days in specified month
       * 
       * @param {integer} month 
       * @param {integer} year 
       */
    }, {
      key: 'daysInMonth',
      value: function daysInMonth(month, year) {
        return new Date(year, month, 0).getDate();
      }

      /**
       * Validate form fields
       * REFACTOR: add ability for user to turn js validation on or off
       * 
       * @param {Object} formData
       * @param {NodeList} elements
       */
    }, {
      key: 'validateForm',
      value: function validateForm(formData, elements) {
        var _this = this;

        var currentYear = new Date().getFullYear(),
            errorClass = 'agegate__input--error',
            errorMessage = this.options.form.querySelector('.agegate__error-message');

        var month = formData.month,
            day = formData.day,
            year = formData.year,
            errorLog = [];

        // verify all field data meets its requirements
        Object.keys(formData).forEach(function (field) {
          // verify year entered is not older than 110 years old and not greater than current year
          if (field === 'year' && (currentYear - year > 110 || currentYear < year)) errorLog.push(field);
          // verify valid month (1-12) has been entered
          else if (field === 'month' && (month < 1 || month > 12)) errorLog.push(field);
            // verify entered month's date is a valid date
            else if (field === 'day' && (day < 1 || day > _this.daysInMonth(month, year))) errorLog.push(field);
        });

        // reset all input fields error callout
        Object.keys(elements).forEach(function (field) {
          // change all elements of type 'text' to default styling
          if (elements[field].type === 'text') elements[field].classList.remove(errorClass);
        });

        // check errorLog for errors
        if (errorLog.length && !!this.options.formValidation) {
          // if there are errors, add call-out styling to the field(s)
          errorLog.forEach(function (field) {
            elements[field].classList.add(errorClass);
          });
          errorMessage.classList.add('agegate__error-message--show');
          // if there are no errors, proceed to verifying user's age
        } else {
            errorMessage.classList.remove('agegate__error-message--show');
            this.respond(this.verify(this.formData));
          }
      }

      /**
       * Parse form data
       * Calculate the age and insert cookie if needed
       * Age calculator by Kristoffer Dorph
       * http://stackoverflow.com/a/15555947/362136
       *
       * @param {Object} formData
       */
    }, {
      key: 'verify',
      value: function verify(formData) {
        _dayjs2['default'].extend(_relativeTime['default']);
        var ok = false;
        var legalAge = this.ages[formData.country] || this.legalAge;
        var currentDate = (0, _dayjs2['default'])();
        var bday = [parseInt(formData.year, 10) || currentDate.getFullYear(), parseInt(formData.month, 10) || currentDate.getMonth() + 1, parseInt(formData.day, 10) || currentDate.getDate()].join('/');
        var age = currentDate.diff(bday, 'year');
        var expiry = formData.remember ? this.options.cookieExpiry : null;

        if (age >= legalAge) {
          ok = true;
        }

        this.saveCookie(expiry, ok);
        return ok;
      }

      /**
       * Create a cookie to remember age
       *
       * @param {*} expiry - Cookie expiration (0|Infinity|Date)
       */
    }, {
      key: 'saveCookie',
      value: function saveCookie() {
        var expiry = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];
        var pass = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

        var path = this.options.path || null;
        var domain = this.options.cookieDomain || null;

        _cookies2['default'].setItem(this.options.cookieName || 'old_enough', pass, expiry, path, domain);
      }

      /**
       * Issue the callback with final verdict
       *
       * @param {boolean} success - Age verification verdict
       * @param {string} message - Error message
       */
    }, {
      key: 'respond',
      value: function respond() {
        var success = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];
        var message = arguments.length <= 1 || arguments[1] === undefined ? 'Age verification failure' : arguments[1];

        if (success) this.callback(null);else this.callback(new Error('[AgeGate] ' + message));
      }
    }, {
      key: 'isEnabled',
      get: function get() {
        return {
          age: !!this.options.age,
          countries: !!this.options.countries,
          data: !!this.options.data
        };
      }
    }, {
      key: 'legalAge',
      get: function get() {
        return parseInt(this.options.age, 10) || 18;
      }
    }, {
      key: 'data',
      get: function get() {
        return this.options.data || _data;
      }

      /**
       * Convert age data into usable key => value
       */
    }, {
      key: 'ages',
      get: function get() {
        var ages = {};

        if (this.options.data) {
          ages = this.data.reduce(function (total, item) {
            total[item.code] = item.age;
            return total;
          }, ages);
        } else {
          for (var cont in this.data) {
            this.data[cont].map(function (country) {
              return ages[country.code] = country.age;
            });
          }
        }

        return ages;
      }
    }]);

    return AgeGate;
  })();

  module.exports = AgeGate;
});