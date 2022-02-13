document.getElementById("btn_show").addEventListener("click", e => {
	if (document.getElementById("control-button-panel").className == "show-control") {
		document.getElementById("btn_show").className = "menu-trigger"
		document.getElementById("control-button-panel").className = "hide-control"
	} else {
		document.getElementById("btn_show").className = "menu-trigger active"
		document.getElementById("control-button-panel").className = "show-control"
	}
})
document.getElementById("btn_favorite").addEventListener("click", e => {
	document.getElementById("btn_show").className = "menu-trigger"
	document.getElementById("control-button-panel").className = "hide-control"
	txtMiru.showFavorite()
})
document.getElementById("btn_config").addEventListener("click", e => {
	document.getElementById("btn_show").className = "menu-trigger"
	document.getElementById("control-button-panel").className = "hide-control"
	txtMiru.showConfig()
})
document.getElementById("btn_oepn").addEventListener("click", e => {
	txtMiru.loadLocalFile();
})
document.getElementById("btn_url").addEventListener("click", e => {
	document.getElementById("btn_show").className = "menu-trigger"
	document.getElementById("control-button-panel").className = "hide-control"
	txtMiru.inputURL()
})
document.getElementById("control-button-panel").addEventListener("click", e => {
	document.getElementById("btn_show").className = "menu-trigger"
	document.getElementById("control-button-panel").className = "hide-control"
})
document.getElementById("btn_first").addEventListener("click", e => {
	txtMiru.pageTop()
})
document.getElementById("btn_prev").addEventListener("click", e => {
	txtMiru.pagePrev()
})
document.getElementById("btn_next").addEventListener("click", e => {
	txtMiru.pageNext()
})
document.getElementById("btn_end").addEventListener("click", e => {
	txtMiru.pageEnd()
})

import { TxtMiru } from './TxtMiru.js?1.0.12.0'
const txtMiru = new TxtMiru("TxtMiruMain")
