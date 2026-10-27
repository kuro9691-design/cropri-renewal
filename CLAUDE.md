# CROPRIリニューアル プロジェクト

## 作業開始時
- このフォルダの CONTEXT.md と PROGRESS.md を読んでから作業する。
- まだない場合は、フォルダ内の既存ファイルと会話から分かる情報で初期版を作る（すでにある場合は上書きしない）。
- この2ファイルが、Claude・Codex・ChatGPT共通の引き継ぎの正本。自分のチャット履歴やメモリより優先する。

## 作業中・終了時
- 長期的な前提・ルール・恒久的な決定が変わったら CONTEXT.md、進捗・直近の決定・未解決・次にやることが変わったら PROGRESS.md を更新する。
- 変更がなければ更新しない。
- 更新の直前にファイルを読み直し、他のAIやユーザーの更新を古い内容で上書きしない。
- 会話ログや日報として追記しない。古い情報・撤回された内容は整理し、現在有効な内容だけを残す。

## 軽く保つ
- CONTEXT.md と PROGRESS.md は短く保つ。詳細な資料は別ファイルにして、2ファイルからは場所だけ示す。
- 詳細ファイルは、その作業をするときだけ読む。

## 作業時間
- 作業の開始時・区切りごと・終了時に、作業時間を記録する。後から推測で埋めない。
- 記録ツール: `C:\Users\user\.codex\cross-agent-handoff\cropri\work_time.py`（記録先は同じフォルダの work_time.json）
  - 共通の書き方（`--dir` は毎回必須）: `python "C:\Users\user\.codex\cross-agent-handoff\cropri\work_time.py" <コマンド> --dir "C:\Users\user\.codex\cross-agent-handoff\cropri" --actor <claude|codex> ...`
  - 開始: `start --task-id "CROPRIリニューアル" --activity "作業内容"`
  - 区切り（意味のある操作・進捗ごと）: `heartbeat --activity "内容"`
  - 席を外す／戻る: `pause` ／ `resume`
  - 終了: `stop`
  - 集計: `report`（担当者・作業ID別の秒数。`--actor` は不要）
- Claude Code は `--actor claude`、Codex は `--actor codex`。人の作業時間を残すときだけ `--actor human` で手動記録する。
- 5分を超える空白は実働に入らない（ツールが自動で idle 扱いにする）。同じ担当者で2つの作業を同時に計測しない。
- 合計が必要なときだけ、PROGRESS.md に「作業時間の合計」を短く書く（記録そのものは work_time.json）。

## 情報の読み分け
- AIが検索・参照する本文は、実体のある `.md` を優先する。`.gdoc` はGoogleドキュメントへの参照ファイルであり、本文として扱わない。
- 同名の `.md` と `.md.gdoc` がある場合、通常作業では `.md` を読む。Googleドキュメント側の更新確認や再同期が必要な場合だけ専用コネクタで原本を読む。
- 事実や判断軸を AGENTS.md / CLAUDE.md に重複して書かない。ここには参照先と、そのプロジェクトに必要な安全ルールだけを書く。
