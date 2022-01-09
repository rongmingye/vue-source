class Observer {
  constructor(data) {
    this.observe(data)
  }

  observe(data) {
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(key => {
        this.defineReactive(data, key, data[key])
      })
    }
  }

  /**
   * 劫持数据
   * @param {*} obj 
   * @param {*} key 
   * @param {*} value 
   */
  defineReactive(obj, key, value) {
    // 递归对所有层的数据进行监听
    this.observe(value)
    const dep = new Dep()
    Object.defineProperty(obj, key, {
      enumerable: true, // 可枚举 
      configurable: false, // 不能再配置
      get() {
        // 订阅者: 订阅数据的变化，往Dep中添加观察者
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set: (newVal) => {
        if (value !== newVal){
          // 对新值重新监听
          this.observe(newVal)
          value = newVal
          // 发布者: 通知变化
          dep.notify()
        }
      }
    })
  }
}

class Dep {
  constructor() {
    this.subs = []
  }

  /**
   * 添加订阅者
   * @param {*} watcher 
   */
  addSub(watcher) {
    this.subs.push(watcher)
  }

  /**
   * 通知变化
   */
  notify() {
    this.subs.forEach(w => w.update())
  }
}

class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm
    this.expr = expr
    this.cb = cb
    this.oldVal = this.getOldVal()
  }

  /**
   * 获取旧的值
   * @returns 
   */
  getOldVal() {
    // 绑定watcher到Dep.target
    Dep.target = this
    // getVal(), 触发get()方法，然后把Dep.target(watcher)放到subs订阅者中
    let oldVal = compileUtil.getVal(this.expr, this.vm)
    Dep.target = null
    return oldVal
  }

  /**
   * 更新视图
   */
  update() {
    let newVal = compileUtil.getVal(this.expr, this.vm)
    if (newVal !== this.oldVal) {
      this.cb(newVal)
    }
  }
}