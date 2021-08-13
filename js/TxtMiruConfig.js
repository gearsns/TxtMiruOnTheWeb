export class TxtMiruConfig {
	constructor(txtMiru) {
		this.txtMiru = txtMiru
		this.configElement = document.createElement("div")
		this.configElement.className = "hide-config"
		this.configElement.innerHTML = `
<div id="config-box-inner" class="config-box-inner">
<button id="config-regist">保存</button><button id="config-rebuild-db" style="display:none">DB再構築</button>
		<dl>
		<dt>テーマ
		<dd class="config-radio-area">
		<input type="radio" name="config-theme-type" id="config-theme-type-light" checked><label for="config-theme-type-light">ライト(標準)</label><input type="radio" name="config-theme-type" id="config-theme-type-dark"><label for="config-theme-type-dark">ダーク</label>
		<dt>フォントサイズ
		<dd class="config-radio-area">
		<input type="radio" name="config-font-size" id="config-font-size-large"><label for="config-font-size-large">大</label><input type="radio" name="config-font-size" id="config-font-size-middle" checked><label for="config-font-size-middle">中</label><input type="radio" name="config-font-size" id="config-font-size-small"><label for="config-font-size-small">小</label>
		<dt>WebサーバーのURL
		<dd><input id="config-server-url" value="">
		<dt>ユーザーID
		<dd><input id="config-user-id" value="">
		</dl>
</div>`.replace(/[\r\n]/g, "")
		document.body.appendChild(this.configElement)
	}

	show = async (txtMiru) => {
		if(txtMiru.display_popup){
			return
		}
		txtMiru.display_popup = true
		this.configElement.className = "show-config"
		if(txtMiru.setting["theme"] == "light"){
			document.getElementById("config-theme-type-light").checked = true
		} else if(txtMiru.setting["theme"] == "dark"){
			document.getElementById("config-theme-type-dark").checked = true
		}
		if(txtMiru.setting["font-size"] == "large"){
			document.getElementById("config-font-size-large").checked = true
		} else if(txtMiru.setting["font-size"] == "small"){
			document.getElementById("config-font-size-small").checked = true
		}
		if(txtMiru.setting["WebServerUrl"]){
			document.getElementById("config-server-url").value = txtMiru.setting["WebServerUrl"]
		}
		if(txtMiru.setting["UserID"]){
			document.getElementById("config-user-id").value = txtMiru.setting["UserID"]
		}
	}
	setEvent = (txtMiru) => {
		document.getElementById("config-box-inner").addEventListener("click", e => {
			e.stopPropagation()
		}, false)
		this.configElement.addEventListener("click", e => {
			this.configElement.className = "hide-config"
			txtMiru.display_popup = false
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
			//
			txtMiru.setting["WebServerUrl"] = document.getElementById("config-server-url").value
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
