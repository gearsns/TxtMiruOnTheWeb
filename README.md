## TxtMiru on the Web

TxtMiru on the Webは、ブラウザ上でネット小説「小説家になろう」、「カクヨム」、「青空文庫」を縦組み表示にして読むことができます。

   ![](image/TxtMiru.png)


### 使い方

1. サイト：[TxtMiru on the Web](https://gearsns.github.io/TxtMiruOnTheWeb/index.html) にアクセス

2. 小説の表示

   「≡」ボタンを押下

   ![](image/TxtMiruMenu1.png)

   「URL」ボタンを押下

   ![](image/TxtMiruMenu2.png)

3. URLを入力して、「開く」ボタンを押下

   ![](image/TxtMiruUrl.png)

#### 機能紹介

1. ショートカット(PC用)

   |キー|機能|
   |--|--|
   |Fキー|お気に入り|
   |Lキー|URL|
   |Oキー|ファイルを開く|
   |Cキー|設定|
   |Ctrl + 左矢印|次のエピソード|
   |Ctrl + 右矢印|前のエピソード|

2. お気に入り

   ![](image/TxtMiruFavorite.png)

   よく見るサイトをお気に入りとして登録できます。
   「最新の情報に更新」機能を使用すると小説の総ページ数が最新の物に更新されます。

3. 設定

   | 機能 | 説明 |
   |--|--|
   |テーマ|「ライト」と「ダーク」の２つのテーマから画面表示を選択できます。<br>![](image/TxtMiruTheme.png)|
   |フォントサイズ|「大」「中」「小」何れかのサイズの指定ができます。|
   | WebサーバーのURL|（オプション）自分でサーバーを設定した場合にはこちらで変更ができます。|
   |ユーザーID|（オプション）上記、「Webサーバー」を設定した場合にサーバーでお気に入りの保存する際に指定します。|


### インストール方法（自分でサーバーを建てる方のみ）

1. ダウンロード

   `
git clone https://github.com/gearsns/TxtMiruOnTheWeb.git
`

2. Google Apps Scriptでサーバーを設定

   Google スプレッドシートの準備

   お気に入り設定用にシートを作成(シート名=ユーザーIDとなります。)

   /server/ActionScript.jsを自身で取得したサイトのApp Scriptにコピーしてください。

   ※シート名は先に作成したシートのIDを指定してください。

### 利用しているソフトウェア
1. Dexie.js https://github.com/dexie/Dexie.js
1. encoding.js https://github.com/polygonplanet/encoding.js
1. JSZip https://stuk.github.io/jszip/

