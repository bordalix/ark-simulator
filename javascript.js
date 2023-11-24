const dqs = (selector) => document.querySelector(selector)

const clock = {
  current: 0,
  intervalId: '',
  paused: false,
  pause: () => clock.removeInterval(),
  play() {
    const maxDays = Number(document.querySelector('#timelock').value)
    // if already running, do nothing
    if (clock.intervalId) return
    // reset and play timeline if on the end of previous timeline
    if (clock.current === maxDays) {
      clock.reset()
      clock.play()
      return
    }
    // start clock
    clock.intervalId = setInterval(() => {
      clock.current += 1
      if (clock.current === maxDays) clock.removeInterval()
      days.db.push(days.randomDay())
      ui.render()
    }, 300)
  },
  reset() {
    clock.removeInterval()
    clock.current = 0
    days.db = []
    ui.render()
  },
  removeInterval: () => {
    if (clock.intervalId) {
      clearInterval(clock.intervalId)
      clock.intervalId = ''
    }
  },
}

const days = {
  db: [],
  untilNow: () => {
    const users = {}
    let eachPayment = 0
    let eachVTXO = 0
    let numEvents = 0
    let numVTXOs = 0
    let sumPayments = 0
    let sumVTXOs = 0
    days.db.forEach((day) => {
      if (!day) return
      day.forEach((event) => {
        if (!users[event.user]) users[event.user] = 0
        users[event.user] += 1
        eachVTXO = event.vtxos.each
        eachPayment = event.payment.value
        numEvents += 1
        numVTXOs = Decimal.add(numVTXOs, event.vtxos.num).toNumber()
        sumPayments = Decimal.add(sumPayments, event.payment.value).toNumber()
        sumVTXOs = Decimal.add(sumVTXOs, event.vtxos.sum).toNumber()
      })
    })
    return {
      eachPayment,
      eachVTXO,
      numEvents,
      numUsers: Object.keys(users).length,
      numVTXOs,
      ratioVTXOsPayments: Decimal.div(sumVTXOs, sumPayments).toNumber(),
      sumPayments,
      sumVTXOs,
    }
  },
  randomDay: () => {
    let day
    const numberUsers = document.querySelector('#numberUsers').value
    const onboardAmount = document.querySelector('#onboardAmount').value
    const timelock = Number(document.querySelector('#timelock').value)
    const moneyVelocity = Decimal.div(timelock, 28)
      .mul(document.querySelector('#moneyVelocity').value)
      .toNumber()
    const numberPayments = Decimal.div(timelock, 28)
      .mul(document.querySelector('#numberPayments').value)
      .toNumber()
    const vtxoRatio = Number(document.querySelector('#vtxoRatio').value)
    const paymentValue = Decimal.mul(onboardAmount, moneyVelocity)
      .div(numberPayments)
      .toNumber()
    const vtxoVal = Decimal.div(onboardAmount, vtxoRatio).toNumber()
    const vtxoNum = Decimal.div(paymentValue, vtxoVal).ceil().toNumber()
    const vtxoSum = Decimal.mul(vtxoNum, vtxoVal).toNumber()
    const paymentChange = Decimal.sub(vtxoSum, paymentValue).toNumber()
    for (let user = 0; user < numberUsers; user++) {
      const rand = timelock * Math.random()
      if (rand < numberPayments) {
        if (!day) day = []
        day.push({
          user,
          payment: {
            value: paymentValue,
            change: paymentChange,
          },
          vtxos: {
            each: vtxoVal,
            num: vtxoNum,
            sum: vtxoSum,
          },
        })
      }
    }
    return day
  },
}

const pretty = {
  btc: (num) => pretty.num(num, 0, 8),
  num: (num = 0, min = 0, max = 2) => {
    if (num === 0) return '0'
    return new Intl.NumberFormat('en-us', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }).format(num)
  },
}

const ui = {
  theme: {
    circle: { radius: 5 },
    colors: [
      'indianred',
      'lightCoral',
      'red',
      'darkred',
      'pink',
      'hotpink',
      'mediumvioletred',
      'lightsalmon',
      'coral',
      'orangered',
      'darkorange',
      'orange',
      'gold',
      'moccasin',
      'khaki',
      'darkkhaki',
      'thistle',
      'plum',
    ],
    margin: 10,
    vSpace: 20,
  },
  renderStats: () => {
    const initialBudget = Number(document.querySelector('#initialBudget').value)
    const {
      eachPayment,
      eachVTXO,
      numUsers,
      numEvents,
      numVTXOs,
      ratioVTXOsPayments,
      sumPayments,
      sumVTXOs,
    } = days.untilNow()
    const budget = {
      initial: initialBudget,
      available: Decimal.sub(initialBudget, sumVTXOs).toNumber(),
      reserved: sumVTXOs,
      used: Decimal.div(sumVTXOs, initialBudget).mul(100).toNumber(),
    }
    const stats = `
      <p>Each: ${pretty.btc(eachPayment)} BTC</p>
      <p>Number of users: ${numUsers}</p>
      <p>Number of events: ${numEvents}</p>
      <p>Total payments: ${pretty.btc(sumPayments)} BTC</p>
    `
    const vtxos = `
      <p>Each: ${pretty.btc(eachVTXO)} BTC</p>
      <p>VTXOs used: ${numVTXOs}</p>
      <p>Total value: ${pretty.btc(sumVTXOs)} BTC</p>
      <p>Ratio value / payments: ${pretty.num(ratioVTXOsPayments)}</p>
    `
    const liquidity = `
      <p>Initial: ${pretty.btc(budget.initial)} BTC</p>
      <p>Available: ${pretty.btc(budget.available)} BTC</p>
      <p>Reserved: ${pretty.btc(budget.reserved)} BTC</p>
      <p>Used: ${pretty.num(budget.used)} %</p>
    `
    document.querySelector('#graph1').innerHTML = stats
    document.querySelector('#graph2').innerHTML = vtxos
    document.querySelector('#graph3').innerHTML = liquidity
  },
  renderTimeline: () => {
    const container = document.querySelector('.timelineContainer')
    const containerWidth = container.offsetWidth - ui.theme.margin * 2
    const steps = document.querySelector('#timelock').value
    const step = Decimal.div(containerWidth, steps).toNumber()
    const height = container.offsetHeight - 2
    const width = clock.current * step + ui.theme.margin * 2
    const viewbox = `0 0 ${width} ${height}`
    // render event inside timeline
    const _event = (event, idx, index) => {
      const r = ui.theme.circle.radius
      const cx = index * step + r + ui.theme.margin
      const cy = (idx + 2) * ui.theme.vSpace
      const fill = ui.theme.colors[event.user % ui.theme.colors.length]
      return `
        <circle alt="alt" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}">
          <title>${JSON.stringify(event, null, 2)}</title>
        </circle>
      `
    }
    // render day inside timeline
    const _day = (day, index) => {
      if (!day) return
      const cx = index * step + ui.theme.circle.radius + ui.theme.margin
      const cy = ui.theme.vSpace
      const idx = index + 1
      const num = `<text text-anchor="middle" x="${cx}" y="${cy}" class="small">${idx}</text>`
      return num + day.map((event, idx) => _event(event, idx, index)).join()
    }
    // render days inside timeline
    const _days = () => days.db.map((day, index) => _day(day, index)).join()
    // timeline is a svg
    const svg = `
        <svg viewBox="${viewbox}" height="${height}" width="${width}" xmlns="http://www.w3.org/2000/svg">
          <style>
            .small {
              font: italic 12px sans-serif;
            }
          </style>
          <rect x="0" y="0" width="100%" height="100%" fill="#eee"/>
          ${_days()}
        </svg>
        `
    document.querySelector('.timelineContainer').innerHTML = svg
  },
  resizeTimeline: () => {
    const numberUsers = Number(document.querySelector('#numberUsers').value)
    const height = (numberUsers + 2) * ui.theme.vSpace
    document.querySelector('.timelineContainer').style.height = `${height}px`
  },
  render: () => {
    ui.resizeTimeline()
    ui.renderTimeline()
    ui.renderStats()
  },
}

window.onload = () => {
  document.querySelector('#pauseButton').onclick = () => clock.pause()
  document.querySelector('#playButton').onclick = () => clock.play()
  document.querySelector('#resetButton').onclick = () => clock.reset()
}
