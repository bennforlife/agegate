import * as data from './data'
import cookies from './cookies'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

const FORM_ELEMENTS = ['year', 'month', 'day', 'country', 'remember']

export default class AgeGate {
  constructor (opts, cb) {
    this.options = opts
    this.callback = cb
    this.isEnabled.data && this.validateData(opts.data)

    // render
    this.isEnabled.countries && this.populate()
    this.options.form.addEventListener('submit', this.submit.bind(this))
  }

  /**
   * Getters & Setters
   */
  get isEnabled () {
    return {
      age: !!this.options.age,
      countries: !!this.options.countries,
      data: !!this.options.data
    }
  }

  get legalAge () {
    return parseInt(this.options.age, 10) || 18
  }

  get data () {
    return this.options.data || data
  }

  /**
   * Convert age data into usable key => value
   */
  get ages () {
    let ages = {}

    if (this.options.data) {
      ages = this.data.reduce((total, item) => {
        total[item.code] = item.age
        return total
      }, ages)
    } else {
      for (let cont in this.data) {
        this.data[cont].map(country => ages[country.code] = country.age)
      }
    }

    return ages
  }

  /**
   * Check data structure of supplied data
   *
   * @param {Array} data
   */
  validateData (data) {
    let random = Math.floor(Math.random() * (data.length - 0) + 0)

    // ensure: containing Array and Object keys
    let ok = (Array.isArray(data) || data instanceof Array)
    ok = ok && ['code', 'name', 'age'].every(k => data[random].hasOwnProperty(k))

    return ok ? data : this.respond(false, 'Supplied data is invalid')
  }

  /**
   * Add countries to <select> element
   */
  populate () {
    let select = this.options.form.querySelector('select')
    select.innerHTML = '' // assume it's not empty

    // attempt to use user-supplied data
    if (this.isEnabled.data) this.data.forEach(country => select.appendChild(createOption(country)))

    // fallback to default data (continent-separated)
    else {
      Object.keys(data).forEach(continent => {
        let group = document.createElement('optgroup')
        group.label = continent

        // create the <option> for each country
        for (let i = 0; i < data[continent].length; i++) {
          let country = data[continent][i]
          group.appendChild(createOption(country))
        }

        select.appendChild(group)
      })
    }

    // create the <option> element
    function createOption (country) {
      let option = document.createElement('option')

      for (let attr in country) {
        option.dataset[attr] = country[attr]
      }
      option.value = country.code
      option.textContent = country.name

      return option
    }
  }

  /**
   * Serialize form data on submit,
   * and pass onto validation
   *
   * @param {Event} e - form submit event
   */
  submit (e) {
    e.preventDefault()

    let elements = e.target.elements

    // create an object from the form data
    this.formData = FORM_ELEMENTS.reduce((collection, key) => {
      if (!elements[key]) return collection

      switch (key) {
        case 'remember':
          collection[key] = elements[key].checked
          break
        default:
          collection[key] = elements[key].value
          break
      }

      return collection
    }, {})

    this.validateForm(this.formData, elements)
  }

  /**
   * Return number of days in specified month
   * 
   * @param {integer} month 
   * @param {integer} year 
   */
  daysInMonth (month, year) {
    return new Date(year, month, 0).getDate();
  }

  /**
   * Validate form fields
   * REFACTOR: add ability for user to turn js validation on or off
   * 
   * @param {Object} formData
   * @param {NodeList} elements
   */
  validateForm (formData, elements) {
    const currentYear = new Date().getFullYear(),
          errorClass = 'age-gate__input--error'
          
    let month = formData.month,
        day = formData.day,
        year = formData.year,
        errorLog = []

    // verify all field data meets its requirements
    Object.keys(formData).forEach(field => {
      // verify year entered is not older than 110 years old and not greater than current year
      if (field === 'year' && (currentYear - year > 110 || currentYear < year)) errorLog.push(field)
      // verify valid month (1-12) has been entered 
      else if (field === 'month' && (month < 1 || month > 12)) errorLog.push(field)
      // verify entered month's date is a valid date
      else if (field === 'day' && (day < 1 || day > this.daysInMonth(month, year))) errorLog.push(field)
    })

    // reset all input fields error callout
    Object.keys(elements).forEach(field => {
      // change all elements of type 'text' to default styling
      if (elements[field].type === 'text') elements[field].classList.remove(errorClass)
    })

    // check errorLog for errors
    if (errorLog.length && !!this.options.formValidation) {
      // if there are errors, add call-out styling to the field(s)
      errorLog.forEach(field => {
        elements[field].classList.add(errorClass)
      })
      // if there are no errors, proceed to verifying user's age
    } else {
      this.respond(this.verify(this.formData)) 
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
  verify (formData) {
    dayjs.extend(relativeTime)
    let ok = false
    let legalAge = this.ages[formData.country] || this.legalAge
    let currentDate = dayjs()
    let bday = [
      parseInt(formData.year, 10) || currentDate.getFullYear(),
      parseInt(formData.month, 10) || currentDate.getMonth() + 1,
      parseInt(formData.day, 10) || currentDate.getDate()
    ].join('/')
    let age = currentDate.diff(bday, 'year')
    let expiry = formData.remember ? this.options.cookieExpiry : null
    
    if (age >= legalAge) {
      ok = true
    }
    
    this.saveCookie(expiry, ok)
    return ok
  }

  /**
   * Create a cookie to remember age
   *
   * @param {*} expiry - Cookie expiration (0|Infinity|Date)
   */
  saveCookie (expiry = null, pass = false) {
    const path = this.options.path || null
    const domain = this.options.cookieDomain || null

    cookies.setItem(this.options.cookieName || 'old_enough', pass, expiry, path, domain)
  }

  /**
   * Issue the callback with final verdict
   *
   * @param {boolean} success - Age verification verdict
   * @param {string} message - Error message
   */
  respond (success = false, message = 'Age verification failure') {
    if (success) this.callback(null)
    else this.callback(new Error(`[AgeGate] ${message}`))
  }
}
