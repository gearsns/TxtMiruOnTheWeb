const split_str = (str, separator) => {
	let output = [],
		lastLastIndex = 0,
		match, lastIndex
	while (match = separator.exec(str)) {
		lastIndex = match.index + match[0].length;
		if (lastIndex > lastLastIndex) {
			if (lastLastIndex != match.index) {
				output.push(str.slice(lastLastIndex, match.index))
			}
			if (match.length > 1 && match.index < str.length) {
				output.push(match.slice(1))
			}
			lastLastIndex = lastIndex
		}
		if (separator.lastIndex === match.index) {
			separator.lastIndex++
		}
	}
	if (lastLastIndex !== str.length) {
		output.push(str.slice(lastLastIndex))
	}
	return output
}
const convertAbsoluteURL = (base_url, url) => {
	if (base_url.match(/[^\/]$/)) {
		base_url += "/"
	}
	let arr_url = base_url.replace(/\/$/, "").split("/")
	if (url.match(/^\//)) {
		arr_url.length = 3
		url = url.replace(/^\/+/, "")
	} else if (arr_url.length > 3) {
		arr_url.pop()
	}
	arr_url = `${arr_url.join("/")}/${url}`.split("/")
	let rep = false
	do {
		rep = false
		for (let i = 3; i < arr_url.length; ++i) {
			const item = arr_url[i]
			if (item == ".") {
				arr_url[i] = null
				rep = true
				break
			} else if (item == "..") {
				arr_url[i] = null
				if (i > 3) {
					arr_url[i - 1] = null
				}
				rep = true
				break
			}
		}
		if (rep) {
			arr_url = arr_url.filter(v => { return v !== null })
		}
	} while (rep)
	return arr_url.filter(v => { return v !== null }).join("/")
}
const escape_mark = node => {
	//try {
	if (node.nodeType == 3) {
		node.nodeValue = node.nodeValue.replace(/([\.・･]+)/ig,
			(all, text) => {
				if (text.length >= 2) {
					let p = ""
					if (text.length % 3 == 0) {
						for (let l = text.length / 3; l > 0; --l) {
							p += "…"
						}
					} else if (text.length % 2 == 0) {
						for (let l = text.length / 2; l > 0; --l) {
							p += "‥"
						}
					} else {
						for (let l = text.length / 3; l > 0; --l) {
							p += "…"
						}
					}
					return p
				}
				return all
			}
		).replace(/[─━]/g, "―").replace(/\-+\-/g,
			all => {
				let p = ""
				for (let l = all.length / 2; l > 0; --l) {
					p += "―"
				}
				return p
			}
		).replace(/[―ー–－−ｰ—\-][―ー–－−ｰ—\-]+/g,
			all => {
				let p = "―"
				let l = 0
				const all_list = all.split("");
				for (const a_index in all_list) {
					if (all_list[a_index].match(/−ｰ—\-/)) {
						l += 1
					} else {
						l += 2
					}
				}
				l /= 2
				for (; l > 0; --l) {
					p += "―"
				}
				return p
			}
		).replace(/゛/g, "\u3099"
		).replace(/／＼/g, "\u3033\u3035"
		).replace(/／″＼/g, "\u3034\u3035"
		).replace(/゜/g, "\u209A"
		).replace(/[\.]{3}/g, `…`
		).replace(/。 *(」|』)/g, (all, p1) => p1
		).replace(/[ 　]+(」|』)/g, (all, p1) => p1
		).replace(/\((笑)\)/g, (all, p1) => `（${p1}）`
		)
	} else if (node.tagName != "RT") {
		escape_mark_list(node.childNodes)
	}
}
const escape_mark_list = nodes => {
	for (let i = 0; i < nodes.length; ++i) {
		escape_mark(nodes[i])
	}
}
const get_tatechuuyoko_top_parent = node => {
	if (node) {
		if (node.nodeName == "#document" || node.className == "tatechuyoko_top") {
			return null
		} else if (
			node.tagName == "BODY"
			|| node.tagName == "DIV"
			|| node.tagName == "P"
		) {
			return node
		}
		return get_tatechuuyoko_top_parent(node.parentNode)
	}
	return null
}
const tatechuuyoko_num = node => {
	if (node.nodeType == 3) {
		if (node.parentNode.className == "tatechuyoko"
			|| !node.nodeValue.match(/([0-9,\.]+)/)) {
			return 0
		}
		let item_list = []
		const arr = split_str(node.nodeValue, /([0-9,\.]+)/g)
		if (arr.length > 0) {
			let skip_num = 0
			for (let i = 0; i < arr.length; ++i) {
				if (skip_num > 0) {
					--skip_num
					if (arr[i] instanceof Array) {
						item_list.push(document.createTextNode(arr[i].join("")))
					} else {
						item_list.push(document.createTextNode(arr[i]))
					}
				} else if (arr[i] instanceof Array) {
					// match text
					const text = arr[i].join("")
					if (text.match(/^[0-9]{4}$/)) {
						// 西暦の日付は縦中横にしない
						const text_date = arr.slice(i).join("")
						if (text_date.match(/^[0-9]{4}[\/ 年]+[0-9]{1,2}[\/ 月]+[0-9]{1,2}[ 日]+[0-9]{1,2}[\: ]+[0-9]{1,2}/)) {
							skip_num = 8
							item_list.push(document.createTextNode(text))
							continue
						} else if (text_date.match(/^[0-9]{4}[\/ 年]+[0-9]{1,2}[\/ 月]+[0-9]{1,2}[日]*/)) {
							skip_num = 4
							item_list.push(document.createTextNode(text))
							continue
						}
					}
					if (text.match(/[0-9]/) && text.length < 4) {
						const ltr_elm = document.createElement("span")
						ltr_elm.className = "tatechuyoko"
						ltr_elm.appendChild(document.createTextNode(text))
						item_list.push(ltr_elm)
					} else {
						item_list.push(document.createTextNode(text))
					}
				} else {
					// #textnode
					item_list.push(document.createTextNode(arr[i]))
				}
			}
		}
		if (item_list.length > 0) {
			for (const new_node of item_list) {
				node.parentNode.insertBefore(new_node, node)
			}
			node.parentNode.removeChild(node)
		}
		return item_list.length
	}
	tatechuuyoko_num_list(node.childNodes)
	return 0
}
const tatechuuyoko_num_list = (nodes) => {
	for (let i = 0; i < nodes.length; ++i) {
		const num = tatechuuyoko_num(nodes[i])
		if (num > 0) {
			i += num - 1
		}
	}
}
const tatechuuyoko_symbol = node => {
	if (node.nodeType == 3) {
		if (node.parentNode.className == "tatechuyoko"
			|| !node.nodeValue.match(/([‼‼︎！？⁈⁇⁉\!\?]+)/)) {
			return
		}
		let item_list = []
		let changed_tatechuyoko = false
		const arr = split_str(node.nodeValue, /([‼‼︎！？⁈⁇⁉\!\?]+)/g)
		if (arr.length >= 1) {
			let novert = false // アルファベットのみの場合は、縦中横にしない
			for (let i = 0; i < arr.length; ++i) {
				if (arr[i] instanceof Array) {
					// match text
					const text = arr[i].join("")
						.replace(/‼/g, "!!")
						.replace(/︎︎‼︎/g, "!!")
						.replace(/！/g, "!")
						.replace(/？/g, "?")
						.replace(/⁈/g, "?!")
						.replace(/⁇/g, "??")
						.replace(/⁉/g, "!?")
					let arr2 = []
					if (text.length > 3) {
						arr2 = text.match(/[\s\S]{1,2}/g) || []
					} else {
						arr2 = [text]
					}
					if (novert) {
						item_list.push(document.createTextNode(arr2.join("")))
					} else {
						for (let j = 0; j < arr2.length; ++j) {
							changed_tatechuyoko = true
							let ltr_elm = document.createElement("span")
							ltr_elm.className = "tatechuyoko"
							ltr_elm.appendChild(document.createTextNode(arr2[j]))
							item_list.push(ltr_elm)
						}
					}
					novert = false
				} else {
					// #textnode
					novert = false
					item_list.push(document.createTextNode(arr[i]))
					if (arr[i].match(/[A-Za-z]\s*$/)) {
						novert = true
					}
				}
			}
		}
		if (changed_tatechuyoko) {
			if (item_list.length > 0) {
				for (const new_node of item_list) {
					node.parentNode.insertBefore(new_node, node)
				}
				node.parentNode.removeChild(node)
				return
			}
		}
		return
	}
	tatechuuyoko_symbol_list(node.childNodes)
}
const tatechuuyoko_symbol_list = nodes => {
	for (let i = 0; i < nodes.length; ++i) {
		tatechuuyoko_symbol(nodes[i])
	}
}
// 縦中横自動設定
const convert_tatechuuyoko_num = doc => {
	const nodes = doc.body.childNodes
	tatechuuyoko_num_list(nodes)
	tatechuuyoko_symbol_list(nodes)
}
// 約物が連続した場合の文字間隔を調整
const yakumono_space = node => {
	if (node.nodeType == 3) {
		//let re_yakumono_space = /([（〔「『［【〈《‘“）〕」』』］】〉》’”。．、，]+)/g
		const re_yakumono_space = /([（〔「『［【〈《）〕」』』］】〉》。．、，]+)/g
		if (node.parentNode.className == "yakumo_spacing"
			|| !node.nodeValue.match(re_yakumono_space)) {
			return
		}
		const arr = split_str(node.nodeValue, re_yakumono_space)
		if (arr.length > 0) {
			let item_list = []
			for (let i = 0; i < arr.length; ++i) {
				if (arr[i] instanceof Array) {
					// match text
					const text = arr[i] + ""
					if (text.length >= 2) {
						const elm_yakumono = document.createElement("span")
						elm_yakumono.className = "yakumono_spacing"
						elm_yakumono.appendChild(document.createTextNode(text.substr(0, text.length - 1)))
						item_list.push(elm_yakumono)
						item_list.push(document.createTextNode(text.substr(text.length - 1, 1)))
					} else {
						item_list.push(document.createTextNode(text))
					}
				} else {
					// #textnode
					item_list.push(document.createTextNode(arr[i]))
				}
			}
			for (const new_node of item_list) {
				node.parentNode.insertBefore(new_node, node)
			}
			node.parentNode.removeChild(node)
			return
		}
		return
	}
	yakumono_space_list(node.childNodes)
}
const yakumono_space_list = nodes => {
	for (let i = 0; i < nodes.length; ++i) {
		yakumono_space(nodes[i])
	}
}
// ruby指定があると行間が空きすぎるのでdata-rubyを設定してinlineにしているが均等割り付けができないのでここで文字間を設定して調整
const convert_ruby = doc => {
	for (const item of doc.getElementsByTagName("ruby")) {
		const rt_list = item.getElementsByTagName("rt") // ルビ文字   かんじ
		let rb_list = item.getElementsByTagName("rb") // ルビベース 漢字
		if(rb_list.length == 0){
			for(const node of item.childNodes){
				if (node.nodeType == 3) {
					const e = doc.createElement("rb")
					e.appendChild(node)
					item.appendChild(e)
					rb_list = item.getElementsByTagName("rb")
					break
				}
			}
		}
		if (rt_list.length == 1 && rb_list.length == 1) {
			let styles = {}
			if (item.style instanceof String) {
				for (const sl of item.style.split(";")) {
					const sl_kv = sl.split(":", 2)
					styles[sl_kv[0]] = sl_kv[1]
				}
			}
			const rt_text = rt_list[0].innerText
				.replace(/゛/g, "\u3099"
				).replace(/／＼/g, "\u3033\u3035"
				).replace(/／″＼/g, "\u3034\u3035"
				).replace(/゜/g, "\u209A"
				)
			const rb_text = rb_list[0].innerText
			item.setAttribute("data-ruby", rt_text)

			// ASCIIのみ
			if (rt_text.match(/^[A-Za-z0-9 -/:-@\[-~]+$/)) {
				//・・・・・
			} else {
				const rt_height = rt_text.length
				const rb_height = rb_text.length * 2
				if (rt_height >= 2 && rt_text.length == rb_text.length) {
					if (rt_text.match(/^・+$/)) {
						item.setAttribute("rt-emphasis", "") // サイズを少し小さく 0.5 -> 0.4
						styles["--rt-letter-spacing"] = `1.5em`
						styles["--rt-margin-top"] = `0.525em` // 0.525
						styles["--rt-margin-bottom"] = "-0.25em" //`${sp / 2}em`
						item.setAttribute("data-ruby", rt_text.replace(/・/g, "﹅"))
					} else {
						item.setAttribute("rt-spacing", "")
						styles["--rt-letter-spacing"] = `1em`
						styles["--rt-margin-top"] = `0.5em`
						styles["--rt-margin-bottom"] = "0em" //`${sp / 2}em`
					}
				} else if (rt_height > 2 && rt_height < rb_height) {
					// ルビ文字がルビベースの高さより小さい時、ルビ文字の文字間隔を広げる
					const sp = (rb_height - rt_height) / (rt_height)
					item.setAttribute("rt-spacing", "")
					styles["--rt-letter-spacing"] = `${sp}em`
					styles["--rt-margin-top"] = `${sp / 2}em`
					styles["--rt-margin-bottom"] = "0em" //`${sp / 2}em`
				} else if (rt_height == 2 && rt_height < rb_height) {
					const sp = (rb_height / 2) // -1 = 上下のpadding(0.5em x 2) + rubyの分 1 *2
					item.setAttribute("rt-spacing", "")
					styles["--rt-letter-spacing"] = `${sp}em`
					styles["--rt-margin-top"] = `0em`
					styles["--rt-margin-bottom"] = `-${sp / 2}em`
				} else if (rt_height > rb_height) {
					const sp = (rt_height - rb_height) / (rb_height / 2 + 1) / 2
					styles["letter-spacing"] = `${sp * 2}em`
					styles["margin-top"] = `${sp}em`
					styles["margin-bottom"] = `-${sp}em`
					item.setAttribute("rt-spacing", "")
					styles["--rt-letter-spacing"] = `0em`
					styles["--rt-margin-top"] = `-${sp}em`
					styles["--rt-margin-bottom"] = `${sp / 2}em`
				} else if (rt_height == 1 && rt_text.length == rb_text.length) {
					if (rt_text.match(/^・+$/)) {
						item.setAttribute("rt-emphasis", "") // サイズを少し小さく 0.5 -> 0.4
						item.setAttribute("data-ruby", rt_text.replace(/・/g, "﹅"))
					}
				}
			}
			let style_list = []
			for (const key of Object.keys(styles)) {
				style_list.push(`${key}:${styles[key]}`)
			}
			item.style = style_list.join(";")
		}
	}
}
// rubyをinline-blockにすると禁則処理が正しく処理されないので、rubyと一緒に行頭・行末禁則文字をspanで囲む
const counterJapaneseHyphenation = doc => {
	let nodes = []
	for (const el of doc.querySelectorAll("[data-ruby]")) {
		nodes.push(el)
	}
	for (const el of doc.getElementsByClassName("tatechuyoko")) {
		nodes.push(el)
	}
	for (const el of nodes) {
		const previousNode = el.previousSibling
		const nextNode = el.nextSibling
		let nextMoveNode = null
		let previousText = ""
		let nextText = ""
		if (previousNode && previousNode.nodeType == 3 && previousNode.nodeValue.match(/([\(\[（〔「『［【〈《‘“]+$)/)) {
			previousText = RegExp.$1
			previousNode.nodeValue = previousNode.nodeValue.replace(/[\(\[（〔「『［【〈《‘“]+$/, "")
		}
		if (nextNode && nextNode.nodeType == 3 && nextNode.nodeValue.match(/^([(\)\[）〕」』』］】〉》’”。．、，]+)/)) {
			nextText = RegExp.$1
			nextNode.nodeValue = nextNode.nodeValue.replace(/^[(\)\[）〕」』』］】〉》’”。．、，]+/, "")
		} else if (nextNode && nextNode.nodeType == 1 && nextNode.className == "yakumono_spacing") {
			nextMoveNode = nextNode
		}
		if (previousText.length == 0 && el.className == "tatechuyoko"
			&& el.innerText.match(/[‼‼︎！？⁈⁇⁉\!\?]/)
			&& previousNode && previousNode.nodeType == 3 && previousNode.nodeValue.match(/(.$)/)) {
			previousText = RegExp.$1
			previousNode.nodeValue = previousNode.nodeValue.replace(/.$/, "")
		}
		if (previousText.length > 0 || nextText.length > 0 || nextMoveNode) {
			const span = doc.createElement("span")
			span.style = "display:inline-block;text-indent:0"
			el.parentNode.insertBefore(span, el)
			if (previousText.length > 0) {
				span.appendChild(doc.createTextNode(previousText))
			}
			span.appendChild(el)
			if (nextText.length > 0) {
				span.appendChild(doc.createTextNode(nextText))
			} else if (nextMoveNode) {
				span.appendChild(nextMoveNode)
			}
		}
	}
}
const convertElementsURL = (doc, url) => {
	for (const el_a of doc.getElementsByTagName("A")) {
		const href = el_a.getAttribute("href")
		if (href && href.match(/javascript:/i)) {
			el_a.style.display = "none"
		} else if (href && !href.match(/^http/) && !href.match(/^#/)) {
			el_a.href = convertAbsoluteURL(url, href)
		}
	}
	for (const el of doc.getElementsByTagName("IMG")) {
		const src = el.getAttribute("src")
		if (src && !src.match(/^http/)) {
			el.src = convertAbsoluteURL(url, src)
		}
		if (el.getAttribute("width")) {
			el.removeAttribute("width")
		}
	}
}
export class TxtMiruLib {
	static KumihanMod = (url, doc) => {
		const nodes = doc.body.childNodes
		convert_ruby(doc)
		escape_mark_list(nodes)
		convert_tatechuuyoko_num(doc)
		yakumono_space_list(nodes)
		counterJapaneseHyphenation(doc)
		convertElementsURL(doc, url)
		for (const el_p of doc.getElementsByTagName("P")) {
			if (el_p.innerHTML.match(/^[ 　―\-]+$/) && el_p.innerHTML.match(/[―\-]/)) {
				el_p.innerHTML = "<hr>"
			}
		}
		for (const el_img of doc.getElementsByTagName("IMG")) {
			el_img.setAttribute("width", "auto")
			el_img.setAttribute("height", "auto")
		}
	}
	static ConvertAbsoluteURL = (base_url, url) => convertAbsoluteURL(base_url, url)
	static HTML2Document = html => {
		const parser = new DOMParser()
		return parser.parseFromString(html.replace(/\<script[\s\S]*?\<\/script\>/ig, "").replace(/\<noscript[\s\S]*?\<\/noscript\>/ig, ""), "text/html")
	}
}
