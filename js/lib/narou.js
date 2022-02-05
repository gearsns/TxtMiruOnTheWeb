export const narou2html = text => {
	const isNarouRubyText = str => (str || "").match(/^[ぁ-んーァ-ヶ・　 ]*$/)
	const totext = html => html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
	let ret = []
	for (const line of text.split(/\n/)) {
		let ruby_start_index = -1
		let line_item = []
		for (const target of line.split(/(｜|\||[《（\()].*?[》）\)]|<.+\|.+>)/)) {
			const rubyStart2Text = index => {
				if (index > 0 && line_item[index - 1].type === "ruby-start") {
					line_item[index - 1].type = "text"
				}
			}
			const setMax10character = () => {
				if (line_item[ruby_start_index].text.length > 10) {
					rubyStart2Text(ruby_start_index)
					// 後ろの１０文字分にルビがかかります。
					const ruby_base = line_item[ruby_start_index].text
					line_item[ruby_start_index].text = ruby_base.slice(0, ruby_base.length - 10)
					line_item.push({ type: "text", text: ruby_base.slice(ruby_base.length - 10) })
					++ruby_start_index
				}
			}
			const splitRuby2 = (target, text, split_type) => {
				let item_type = "ruby"
				if (line_item[ruby_start_index].text.match(/^(.*[　 ])(.*)([　 ])(.*)$/)) {
					// スペースを 一つ 含む場合、分割してルビが振られます。
					const org_text = RegExp.$1
					const ruby_base_1 = RegExp.$2
					const ruby_base_2 = RegExp.$4
					const space = RegExp.$3
					if (text.match(/^(.*)([　 ])(.*)$/)) {
						const org_ruby_start_index = ruby_start_index
						text = RegExp.$3
						line_item[ruby_start_index].text = org_text
						line_item.push({ type: "text", text: ruby_base_1 })
						ruby_start_index = line_item.length - 1
						line_item.push({ type: "ruby", text: RegExp.$1, start: ruby_start_index })
						line_item.push({ type: "text", text: "　"/*space*/ })
						line_item.push({ type: "text", text: ruby_base_2 })
						ruby_start_index = line_item.length - 1
						rubyStart2Text(org_ruby_start_index)
					}
				} else if (split_type === 1 && line_item[ruby_start_index].text.match(/^(.*)([　 ])(.*)$/)) {
					// スペースを 一つ 含む場合、分割してルビが振られます。
					const ruby_base_1 = RegExp.$1
					const ruby_base_2 = RegExp.$3
					const space = RegExp.$2
					if (text.match(/^(.*)([　 ])(.*)$/)) {
						text = RegExp.$3
						line_item[ruby_start_index].text = ruby_base_1
						line_item.push({ type: "ruby", text: RegExp.$1, start: ruby_start_index })
						line_item.push({ type: "text", text: "　"/*space*/ })
						line_item.push({ type: "text", text: ruby_base_2 })
						ruby_start_index = line_item.length - 1
					}
				}
				return [text, item_type]
			}
			const splitRuby = (target, text) => {
				let item_type = "ruby"
				if ((text.match(/[　 ]/g) || []).length >= 2) {
					item_type = "text"
					rubyStart2Text(ruby_start_index)
				} else if (text.match(/[　 ].+/)) {
					return splitRuby2(target, text, 0)
				}
				return [text, item_type]
			}
			const autoDetectRubyBase = (target, text) => {
				let item_type = "ruby"
				if ((text.match(/[　 ]/g) || []).length >= 2) {
					item_type = "text"
					rubyStart2Text(ruby_start_index)
				} else if (text.match(/[　 ].+/)) {
					// 々 及び 〇(ゼロ) は漢字として認識させない
					let pattern = '(.*?)((?:[一-龠仝〆ヶ]|[-_@0-9a-zA-Z]|[—―＿＠０-９Ａ-Ｚａ-ｚ　 ])+)$'
					const re = new RegExp(pattern, 'g')
					const pre_text = line_item[line_item.length - 1].text
					if (pre_text.match(re)) {
						line_item[line_item.length - 1].text = RegExp.$1
						line_item.push({ type: "text", text: RegExp.$2 })
						ruby_start_index = line_item.length - 1
						setMax10character()
						return splitRuby2(target, text, 1)
					} else {
						item_type = "text"
					}
				} else {
					// 々 及び 〇(ゼロ) は漢字として認識させない
					let pattern = '(.*?)((?:[一-龠仝〆ヶ]|[-_@0-9a-zA-Z]|[—―＿＠０-９Ａ-Ｚａ-ｚ])+)$'
					const re = new RegExp(pattern, 'g')
					const pre_text = line_item[line_item.length - 1].text
					if (pre_text.match(re)) {
						line_item[line_item.length - 1].text = RegExp.$1
						line_item.push({ type: "text", text: RegExp.$2 })
						ruby_start_index = line_item.length - 1
						setMax10character()
					} else {
						item_type = "text"
					}
				}
				return [text, item_type]
			}
			//
			if (target.match(/^<(.*)\|(.*)>$/)) {
				const icode = RegExp.$1
				const userid = RegExp.$2
				line_item.push({ type: "tag", text: `<a href="https://${userid}.mitemin.net/${icode}" target="_blank"><img src="https://${userid}.mitemin.net/userpageimage/viewimagebin/icode/${icode}" alt="挿絵(by みてみん)" border="0"></a>` })
			} else if (target.match(/^《(.*?)[）\)》]$/)) {
				let item_type = "ruby"
				let text = RegExp.$1
				if (text.length > 20) {
					// ｜を使った場合でも、自動ルビ化でも、 ルビ 部分が２０文字を超えるとルビ化はされません。
					if (ruby_start_index >= 0) {
						line_item[ruby_start_index].type = "text"
					}
					item_type = "text"
				} else if (ruby_start_index >= 0) {
					if (line_item.length === 0 || ruby_start_index === line_item.length - 1) {
						// ルビを振りたくない場合
						if (ruby_start_index === line_item.length - 1) {
							line_item[ruby_start_index].text = ""
						}
						line_item[ruby_start_index].type = "text"
						item_type = "text"
					}
					++ruby_start_index
					if (item_type === "ruby") {
						[text, item_type] = splitRuby(target, text)
					}
					if (item_type === "ruby") {
						setMax10character()
					}
					if (item_type === "ruby" && target.match(/^《.*[）\)]$/)) {
						// バグ再現用
						text = text.replace(/[ 　].*$/, "")
					}
				} else if (line_item.length > 0) {
					if (isNarouRubyText(text) && !text.match(/^[ 　]/)) {
						// 自動で範囲を探すのは、ひらがな、カタカナ、ー、・(中黒)、スペース のみ
						[text, item_type] = autoDetectRubyBase(target, text)
					} else {
						item_type = "text"
					}
				}
				if (item_type === "ruby") {
					line_item.push({ type: item_type, text: text, start: ruby_start_index })
				} else {
					line_item.push({ type: item_type, text: target })
				}
				ruby_start_index = -1
			} else if (target.match(/^[（\()](.*?)[）\)》]$/)) {
				let item_type = "ruby"
				let text = RegExp.$1
				if (text.length > 20) {
					// ｜を使った場合でも、自動ルビ化でも、 ルビ 部分が２０文字を超えるとルビ化はされません。
					if (ruby_start_index >= 0) {
						line_item[ruby_start_index].type = "text"
					}
					item_type = "text"
				} else if (isNarouRubyText(text) && !text.match(/^[ 　]/) && (text.match(/[ 　]/g) || []).length < 2) {
					// （）で使えるルビは、ひらがな、カタカナ、ー、・(中黒)、スペース のみ
					// スペースがカッコ直後ならルビにしない
					// スペースが2つ以上含む場合、ルビにしない
					if (ruby_start_index >= 0) {
						if (line_item.length === 0 || ruby_start_index === line_item.length - 1) {
							// ルビを振りたくない場合
							if (ruby_start_index === line_item.length - 1) {
								line_item[ruby_start_index].text = ""
							}
							line_item[ruby_start_index].type = "text"
							item_type = "text"
						}
						++ruby_start_index
						if (item_type === "ruby") {
							[text, item_type] = splitRuby(target, text)
						}
						if (item_type === "ruby") {
							setMax10character()
						}
						if (item_type === "ruby") {
							// バグ再現用
							text = text.replace(/[ 　].*$/, "")
						}
					} else if (line_item.length > 0) {
						[text, item_type] = autoDetectRubyBase(target, text)
					}
				} else {
					if (ruby_start_index >= 0) {
						line_item[ruby_start_index].type = "text"
					}
					item_type = "text"
				}
				if (item_type === "ruby") {
					line_item.push({ type: item_type, text: text, start: ruby_start_index })
				} else {
					line_item.push({ type: item_type, text: target })
				}
				ruby_start_index = -1
			} else if (target.match(/^[｜\|]/)) {
				if (ruby_start_index >= 0) {
					line_item[ruby_start_index].type = "text"
				}
				ruby_start_index = line_item.length
				line_item.push({ type: "ruby-start", text: target })
			} else if (target && target.length > 0) {
				line_item.push({ type: "text", text: target })
			}
		}
		if (ruby_start_index >= 0) {
			line_item[ruby_start_index].type = "text"
		}
		for (const item of line_item) {
			if (item.type === "ruby" && line_item[item.start]) {
				line_item[item.start].type = "ruby_rb"
			}
		}
		ret.push(line_item)
	}
	let html_arr = []
	for (const line_item of ret) {
		html_arr.push("<p>")
		for (const item of line_item) {
			if (item.type === "text") {
				html_arr.push(totext(item.text))
			} else if (item.type === "ruby" && line_item[item.start]) {
				html_arr.push(`<ruby>${line_item[item.start].text}<rt>${item.text}</rt></ruby>`)
			} else if (item.type === "tag") {
				html_arr.push(item.text)
			}
		}
		html_arr.push("</p>")
	}
	return html_arr.join("")
}