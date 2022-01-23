import { TxtMiruMessageBox } from "./TxtMiruMessageBox.js?1.0.10.0"

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
		<input type="radio" name="config-font-size" id="config-font-size-large"><label for="config-font-size-large">大</label><input type="radio" name="config-font-size" id="config-font-size-middle" checked><label for="config-font-size-middle">中</label><input type="radio" name="config-font-size" id="config-font-size-small"><label for="config-font-size-small">小</label>
		<dt>メニューの位置
		<dd class="config-radio-area">
		<input type="radio" name="config-menu-position" id="config-menu-position-top" checked><label for="config-menu-position-top">上</label><input type="radio" name="config-menu-position" id="config-menu-position-bottom"><label for="config-menu-position-bottom">下</label>
		<dt>WebサーバーのURL
		<dd><input id="config-server-url" value="">
		<dt>WebSocketサーバーのURL
		<dd><input id="config-websocket-server-url" value="">
		<dt>ユーザーID
		<dd><input id="config-user-id" value="">
		<dt>あなたは18歳以上ですか？
		<dd class="config-radio-area">
		<input type="radio" name="config-over18" id="config-over18-no" checked><label for="config-over18-no">NO</label><input type="radio" name="config-over18" id="config-over18-yes"><label for="config-over18-yes">YES</label>
		</dl>
</div>`.replace(/[\r\n]/g, "")
		document.body.appendChild(this.configElement)
	}

	setValue = setting => {
		if(setting["theme"] == "light"){
			document.getElementById("config-theme-type-light").checked = true
		} else if(setting["theme"] == "dark"){
			document.getElementById("config-theme-type-dark").checked = true
		} else {
			document.getElementById("config-theme-type-light").checked = true
		}
		if(setting["font-size"] == "large"){
			document.getElementById("config-font-size-large").checked = true
		} else if(setting["font-size"] == "small"){
			document.getElementById("config-font-size-small").checked = true
		} else {
			document.getElementById("config-font-size-middle").checked = true
		}
		if(setting["menu-position"] == "bottom"){
			document.getElementById("config-menu-position-bottom").checked = true
		} else {
			document.getElementById("config-menu-position-top").checked = true
		}
		if(setting["over18"] == "yes"){
			document.getElementById("config-over18-yes").checked = true
		} else {
			document.getElementById("config-over18-no").checked = true
		}
		if(setting["WebServerUrl"]){
			document.getElementById("config-server-url").value = setting["WebServerUrl"]
		} else {
			document.getElementById("config-server-url").value = ""
		}
		if(setting["WebSocketServerUrl"]){
			document.getElementById("config-websocket-server-url").value = setting["WebSocketServerUrl"]
		} else {
			document.getElementById("config-websocket-server-url").value = ""
		}
		if(setting["UserID"]){
			document.getElementById("config-user-id").value = setting["UserID"]
		} else {
			document.getElementById("config-user-id").value = ""
		}
	}
	show = async (txtMiru) => {
		if(txtMiru.display_popup){
			return
		}
		txtMiru.display_popup = true
		this.configElement.className = "show-config"
		this.setValue(txtMiru.setting)
	}
	setEvent = (txtMiru) => {
		document.getElementById("config-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		this.configElement.addEventListener("click", e => {
			this.configElement.className = "hide-config"
			txtMiru.display_popup = false
		})
		document.getElementById("config-close").addEventListener("click", e => {
			this.configElement.className = "hide-config"
			txtMiru.display_popup = false
		})
		document.getElementById("config-reset").addEventListener("click", e => {
			TxtMiruMessageBox.show("デフォルトの設定に戻します。", { "buttons": [{ text: "戻す", className: "seigaiha_blue", value: "reset" }, "戻さない"] }).then(async e => {
				if (e == "reset") {
					this.setValue(txtMiru.defaultSetting())
				}
			})
		})
		document.getElementById("config-regist").addEventListener("click", e => {
			if(document.getElementById("config-theme-type-light").checked){
				txtMiru.setting["theme"] = "light"
			} else if(document.getElementById("config-theme-type-dark").checked){
				txtMiru.setting["theme"] = "dark"
			}
			//
			if(document.getElementById("config-font-size-large").checked){
				txtMiru.setting["font-size"] = "large"
			} else if(document.getElementById("config-font-size-middle").checked){
				txtMiru.setting["font-size"] = "middle"
			} else if(document.getElementById("config-font-size-small").checked){
				txtMiru.setting["font-size"] = "small"
			}
			if(document.getElementById("config-menu-position-bottom").checked){
				txtMiru.setting["menu-position"] = "bottom"
			} else {
				txtMiru.setting["menu-position"] = "top"
			}
			if(document.getElementById("config-over18-yes").checked){
				txtMiru.setting["over18"] = "yes"
			} else {
				txtMiru.setting["over18"] = "no"
			}
			//
			txtMiru.setting["WebServerUrl"] = document.getElementById("config-server-url").value
			txtMiru.setting["WebSocketServerUrl"] = document.getElementById("config-websocket-server-url").value
			txtMiru.setting["UserID"] = document.getElementById("config-user-id").value
			txtMiru.saveSetting().then(ret => {
				this.configElement.className = "hide-config"
				txtMiru.reflectSetting()
				txtMiru.display_popup = false
			}).catch(ret => {
			})
		})
		document.getElementById("config-rebuild-db").addEventListener("click", e => {
			txtMiru.txtMiruDB.db.delete()
			txtMiru.txtMiruDB.db.version(1).stores({
				Favorite: "++id,name,author,url,cur_url,cur_page,max_page",
				Bookmark: "++url,title,postion",
				Setting: "id,value"
			})
			txtMiru.saveSetting().then(ret => {
				this.configElement.className = "hide-config"
				txtMiru.reflectSetting()
				txtMiru.display_popup = false
			}).catch(ret => {
			})
		})
	}
}
