class Vue {
  constructor(options) {
    this.$el = options.el
    this.$data = options.data()
    this.options = options

    if (this.$el) {
      // 1. 实现一个数据监听器Observe
      new Observer(this.$data)
      // 把数据获取的操作都代理到vm.$data上
      this.proxyData(this.$data)
      // 2. 实现一个指令解析器Compile
      new Compile(this.$el, this)
    }
  }

  /**
   * 代理获取数据
   * @param {*} data 
   */
  proxyData(data) {
    for(let key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key]
        },
        set(newVal) {
          data[key] = newVal
        }
      })
    }
  }
}

class Compile {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm

    // 使用文档碎片进行缓存，减少页面的回流和重绘
    // 因为每次匹配到进行替换时,会导致页面的回流和重绘,影响页面的性能
    // 获取文档碎片
    const fragment = this.node2Fragment(this.el)
    this.compile(fragment)
    // 把文档碎片添加到根元素中
    this.el.appendChild(fragment)
  }

  /**
   * 创建文档碎片
   * @param {*} el 
   * @returns 
   */
  node2Fragment(el) {
    const fragment = document.createDocumentFragment()
    let firstChild
    while (firstChild = el.firstChild) {
      console.log(firstChild);
      fragment.appendChild(firstChild)
    }
    return fragment
  }

  /**
   * 编译文档碎片
   * @param {*} fragment 
   */
  compile(fragment) {
    // 获取子节点
    const childNodes = [...fragment.childNodes]
    childNodes.forEach(child => {
      if(this.isElementNode(child)) {
        // 元素节点
        this.compileElement(child)
      } else {
        // 文本节点
        this.compileText(child)
      }
      // 递归遍历子元素
      if (child.childNodes && child.childNodes.length) {
        this.compile(child)
      }
    })
  }

  /**
   * 编译元素节点
   * @param {*} node 
   */
  compileElement(node) {
    // 获取所有属性
    const attributes = [...node.attributes]
    // 遍历属性
    attributes.forEach(attr => {
      const {name, value} = attr
      if (this.isDirective(name)) {
        const [,directive] = name.split('-') // text html model
        const [dirName, eventName] = directive.split(':') // v-on:click v-bind:src
        // 更新数据
        compileUtil[dirName] && compileUtil[dirName](node, value, this.vm, eventName)
        // 移除当前元素中的属性
        node.removeAttribute('v-' + directive)

      } else if (this.isEventName(name)) {
        const [,eventName] = name.split("@")
        compileUtil['on'](node, vlaue, this.vm, eventName)
      }

    })
  }

  /**
   * 编译文本节点
   * @param {*} node 
   */
   compileText(node) {
    const content = node.textContent
    if (/\{\{(.+?)\}\}/.test(content)) {
      compileUtil['text'](node, content, this.vm)
    }
  }

  isEventName(attrName) {
    return attrName.startsWith('@')
  }

  isDirective(attrName) {
    return attrName.startsWith('v-')
  }

  isElementNode(node) {
    return node.nodeType === 1
  }
}

const compileUtil = {
  getVal(expr, vm) {
    console.log(expr, vm);
    // 获取表达式的值的方法 person.name
    return expr.split('.').reduce((data, currentVal) => {
      return data[currentVal]
    }, vm.$data)
  },
  setVal(vm, expr, val){
    return expr.split('.').reduce((data, currentVal, index, arr) => {
      index === arr.length -1 && (data[currentVal] = val)
      return data[currentVal]
    }, vm.$data)
  },
  //获取新值 对{{a}}--{{b}} 这种格式进行处理
  getContentVal(expr, vm) {
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getVal(args[1], vm);
    })
  },
  text(node, expr, vm) {
    let val 
    if (expr.indexOf('{{') !== -1) {
      // expr可能是{{obj.name}}--{{obj.age}}
      val = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
        // 订阅数据变化，绑定watcher，从而更新函数
        new Watcher(vm, args[1], ()=> {
          this.updater.textUpdater(node, this.getContentVal(expr, vm))
        })
        return this.getVal(args[1], vm)
      })
    } else {
      // v-text
      val = this.getVal(expr, vm)
    }
    this.updater.textUpdater(node, val)
  },
  html(node, expr, vm) {
    let val = this.getVal(expr, vm)
    // 订阅数据变化，绑定watcher, 从而更新函数
    new Watcher(vm, expr, (newVal)=> {
      this.updater.htmlUpdater(node, newVal)
    })
    this.updater.htmlUpdater(node, val)
  },
  model(node, expr, vm) {
    // 数据==>视图
    new Watcher(vm, expr, (newVal) => {
      this.updater.modelUpdater(node, newVal);
    })
    // 视图==>数据=>视图
    node.addEventListener('input',(e)=>{
      // 设置值
      this.setVal(vm, expr, e.target.value)
    },false);
    this.updater.modelUpdater(node, this.getVal(expr, vm))
  },
  on(node, expr, vm, eventName) {
    // 对事件进行处理
    let fn = vm.options.methods && vm.options.methods[expr]
    node.addEventListener(eventName, fn.bind(vm), false)
  },
  bind(node, expr, vm, attrName) {
    // 对绑定属性进行处理
    let val = this.getVal(expr, vm)
    this.updater.attrUpdater(node, attrName, val)
  },
  updater: {
    attrUpdater(node, attrName, attrVal) {
      node.setAttribute(attrName, attrVal)
    },
    modelUpdater(node, value) {
      node.value = value
    },
    textUpdater(node, value) {
      node.textContent = value
    },
    htmlUpdater(node, value) {
      node.innerHTML = value
    }
  }
}