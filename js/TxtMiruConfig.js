import { TxtMiruMessageBox } from "./TxtMiruMessageBox.js?1.0.19.5"

const checkTypes = [
	{
		target: "theme",
		list: {
			"theme-type-light": "light",
			"theme-type-dark": "dark"
		}, 
		def: "light"
	}, {
		target: "font-size", 
		list: {
			"font-size-large-p": "large-p",
			"font-size-large": "large",
			"font-size-middle": "middle",
			"font-size-small": "small",
		},
		def: "middle"
	}, {
		target :"menu-position",
		list: {"menu-position-bottom": "bottom"},
		def: "top"
	}, {
		target : "show-episode-button",
		list: {"show-episode-true": "true"},
		def: "false"
	} , {
		target: "show-index-button",
		list: {"show-index-true": "true"},
		def: "false"
	}, {
		target: "over18",
		list: {"over18-yes": "yes"},
		def: "no"
	} , {
		target: "page-scroll-effect-animation",
		list: {"page-scroll-effect-animation-yes": true},
		def: false
	}, {
		target: "page-prefetch",
		list: {"prefetch-yes": true}, 
		def: false
	}
]
const textTypes = {
	"tap-scroll-next-per": "tap-scroll-next-per",
	"config-server-url": "WebServerUrl",
	"config-websocket-server-url": "WebSocketServerUrl",
	"config-user-id": "UserID",
	"delay-set-scroll-pos-state": "delay-set-scroll-pos-state"
}
const setValue = setting => {
	const setChecked = item => {
		for (const [id, value] of Object.entries(item.list)){
			if (setting[item.target] === value){
				document.getElementById(`config-${id}`).checked = true
				return
			}
		}
		for (const [id, value] of Object.keys(item.list)){
			if (item.def === value){
				document.getElementById(`config-${id}`).checked = true
				return
			}
		}
	}
	for(const item of checkTypes){
		setChecked(item)
	}
	for(const [key, value] of Object.entries(textTypes)){
		document.getElementById(key).value = setting[value] || ""
	}
}
const setEvent = (configElement, txtMiru) => {
	document.getElementById("config-box-inner").addEventListener("click", e => {
		e.stopPropagation()
	}, false)
	const hideConfig = _ => {
		configElement.className = "hide-config"
		txtMiru.display_popup = false
	}
	configElement.addEventListener("click", hideConfig)
	document.getElementById("config-close").addEventListener("click", hideConfig)
	document.getElementById("config-reset").addEventListener("click", e => {
		TxtMiruMessageBox.show("デフォルトの設定に戻します。", { "buttons": [{ text: "戻す", className: "seigaiha_blue", value: "reset" }, "戻さない"] }).then(async e => {
			if (e === "reset") {
				setValue(txtMiru.defaultSetting())
			}
		})
	})
	const saveSetting = _ => {
		txtMiru.saveSetting().then(ret => {
			txtMiru.reflectSetting()
			hideConfig()
		}).catch(ret => {
		})
	}
	document.getElementById("config-regist").addEventListener("click", e => {
		for(const item of checkTypes){
			txtMiru.setting[item.target] = item.def
			for(const [id, value] of Object.entries(item.list)){
				if(document.getElementById(`config-${id}`).checked){
					txtMiru.setting[item.target] = value
					break
				}
			}
		}
		for(const [key, value] of Object.entries(textTypes)){
			txtMiru.setting[value] = document.getElementById(key).value
		}
		saveSetting()
	})
	document.getElementById("config-rebuild-db").addEventListener("click", e => {
		txtMiru.txtMiruDB.db.delete()
		txtMiru.txtMiruDB.db.version(1).stores({
			Favorite: "++id,name,author,url,cur_url,cur_page,max_page",
			Bookmark: "++url,title,postion",
			Setting: "id,value"
		})
		saveSetting()
	})
}
export class TxtMiruConfig {
	constructor(txtMiru) {
		this.txtMiru = txtMiru
		this.configElement = document.createElement("div")
		this.configElement.className = "hide-config"
		this.configElement.innerHTML = `
<div id="config-box-inner" class="config-box-inner">
<button id="config-regist">保存</button><button id="config-rebuild-db" style="display:none">DB再構築</button>
<button id="config-reset" class="update">デフォルト設定に戻す</button>
<button id="config-close" class="seigaiha_blue">閉じる</button>
<dl>
	<dt>テーマ
	<dd class="config-radio-area">
	<input type="radio" name="config-theme-type" id="config-theme-type-light" checked><label for="config-theme-type-light">ライト(標準)</label><input type="radio" name="config-theme-type" id="config-theme-type-dark"><label for="config-theme-type-dark">ダーク</label>
	<dt>フォントサイズ
	<dd class="config-radio-area">
	<input type="radio" name="config-font-size" id="config-font-size-large-p"><label for="config-font-size-large-p">大(+)</label><input type="radio" name="config-font-size" id="config-font-size-large"><label for="config-font-size-large">大</label><input type="radio" name="config-font-size" id="config-font-size-middle" checked><label for="config-font-size-middle">中</label><input type="radio" name="config-font-size" id="config-font-size-small"><label for="config-font-size-small">小</label>
	<dt>メニューの位置
	<dd class="config-radio-area">
	<input type="radio" name="config-menu-position" id="config-menu-position-top" checked><label for="config-menu-position-top">上</label><input type="radio" name="config-menu-position" id="config-menu-position-bottom"><label for="config-menu-position-bottom">下</label>
	<dt>次話、前話ボタン
	<dd class="config-radio-area">
	<input type="radio" name="config-show-episode" id="config-show-episode-true" checked><label for="config-show-episode-true">表示</label><input type="radio" name="config-show-episode" id="config-show-episode-false"><label for="config-show-episode-false">非表示</label>
	<dt>目次ボタン
	<dd class="config-radio-area">
	<input type="radio" name="config-show-index" id="config-show-index-true" checked><label for="config-show-index-true">表示</label><input type="radio" name="config-show-index" id="config-show-index-false"><label for="config-show-index-false">非表示</label>
	<dt>画面端タップでスクロール(0-100を指定:0で無効,50で画面半分の左側タップで次のページへ)
	<dd><input id="tap-scroll-next-per" value="">%
	<dt>WebサーバーのURL
	<dd><input id="config-server-url" value="">
	<dt>WebSocketサーバーのURL
	<dd><input id="config-websocket-server-url" value="">
	<dt>ユーザーID
	<dd><input id="config-user-id" value="">
	<dt>あなたは18歳以上ですか？
	<dd class="config-radio-area">
	<input type="radio" name="config-over18" id="config-over18-no" checked><label for="config-over18-no">NO</label><input type="radio" name="config-over18" id="config-over18-yes"><label for="config-over18-yes">YES</label>
	<dt>スクロール位置を履歴に保存するまでの待機時間:ミリ秒 (1/1000 秒)
	<dd><input id="delay-set-scroll-pos-state" value="">
	<dt>スクロール時のアニメーションエフェクトを追加する
	<dd class="config-radio-area">
	<input type="radio" name="config-page-scroll-effect-animation" id="config-page-scroll-effect-animation-no"><label for="config-page-scroll-effect-animation-no">NO</label>
	<input type="radio" name="config-page-scroll-effect-animation" id="config-page-scroll-effect-animation-yes" checked><label for="config-page-scroll-effect-animation-yes">YES</label>
	<dt>プリフェッチ処理を行う
	<dd class="config-radio-area">
	<input type="radio" name="config-prefetch" id="config-prefetch-no"><label for="config-prefetch-no">NO</label>
	<input type="radio" name="config-prefetch" id="config-prefetch-yes" checked><label for="config-prefetch-yes">YES</label>
</dl></div>`.replace(/[\r\n]/g, "")
		document.body.appendChild(this.configElement)
		setEvent(this.configElement, txtMiru)
	}
	show = async _ => {
		if(this.txtMiru.display_popup){
			return
		}
		this.txtMiru.display_popup = true
		this.configElement.className = "show-config"
		setValue(this.txtMiru.setting)
	}
}