# 技術スタック選定書 (スタンドアロン・デスクトップアプリ版)

本プロジェクト「Aegis」を、サーバー不要の完全ローカル動作するデスクトップアプリケーションとして構築するための技術選定です。
Webアプリ版と異なり、サーバーコストが一切かからず、プライバシー保護の観点でも最も安全な構成となります。

## 1. システムアーキテクチャ概要

```mermaid
graph TD
    User[ユーザー (PC)] -->|操作| UI[Electron (Frontend)]
    
    subgraph "Aegis Desktop App"
        UI -->|IPC / Local HTTP| PythonProcess[Python Subprocess (AI Engine)]
        PythonProcess -->|PyTorch| Model[Aegis Model (Nightshade/i2i)]
        UI -->|File System| LocalStorage[ローカルディスク]
    end
```

---

## 2. フロントエンド (UIレイヤー)

Web技術を使ってデスクトップアプリを作れる **Electron** を採用します。

- **Framework**: [Electron](https://www.electronjs.org/)
    - クロスプラットフォーム（Windows, Mac, Linux）対応。
    - 豊富なプラグインとコミュニティサポート。
- **UI Library**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
    - 高速なビルドとモダンな開発体験。
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
    - ダークモード、洗練されたUI構築のためWeb版と同じものを採用可能。

---

## 3. バックエンド (AI処理レイヤー)

アプリ内にPython環境を内包（バンドル）し、ユーザーのPCリソースを使って計算を行います。

- **Language**: Python 3.10+
- **Execution**: [PyInstaller](https://pyinstaller.org/) または [Nuitka](https://nuitka.net/)
    - Pythonスクリプトと依存ライブラリを1つの実行ファイルにパッケージ化し、PythonがインストールされていないPCでも動作するようにする。
- **Communication**: 
    - ElectronのメインプロセスからPythonの実行ファイルを子プロセス（Subprocess）として起動。
    - 標準入出力（stdio）またはローカルのFlask/FastAPIサーバーを立ててHTTP通信で画像データのやり取りを行う。
- **AI Libraries**:
    - [PyTorch](https://pytorch.org/) (CPU/MPS/CUDA 対応)
    - [Diffusers](https://huggingface.co/docs/diffusers/index)
    - [NumPy](https://numpy.org/), [Pillow](https://python-pillow.org/)

---

## 4. データ管理

- **設定保存**: [electron-store](https://github.com/sindresorhus/electron-store)
    - ユーザー設定（デフォルトの防御レベルなど）をJSONでローカル保存。
- **画像保存**: ローカルファイルシステム
    - 処理後の画像はユーザーが指定したフォルダに直接保存されるため、一時保存の削除処理などは不要。

---

## 5. スタンドアロン版のメリット・デメリット

| 項目 | Webアプリ版 (SaaS) | **スタンドアロン版 (Desktop)** |
| :--- | :--- | :--- |
| **コスト** | サーバー代がかかる可能性あり (AI計算) | **完全無料** (ユーザーの電気代のみ) |
| **プライバシー** | サーバーへのアップロードが必要 | **最強** (画像はPCから出ない) |
| **処理速度** | サーバーのスペック次第 (無料枠は遅い) | **ユーザーのPCスペック次第** (GPUがあれば爆速) |
| **オフライン** | 不可 | **可能** |
| **セットアップ** | 不要 (URLを開くだけ) | 必要 (インストール & 初回モデルDL) |
| **アプリサイズ** | 軽量 | **巨大** (AIモデルを含めると数GBになる可能性あり) |

## 6. 開発ロードマップ (推奨)

1.  **Pythonエンジンのプロトタイプ作成**: Nightshade風のノイズを加えるPythonスクリプト単体を作成・検証。
2.  **Electronアプリの雛形作成**: React + TypeScriptでUIを作成。
3.  **結合 (IPC実装)**: ElectronからPythonスクリプトを呼び出し、結果を受け取る仕組みの実装。
4.  **パッケージング**: 配布可能なインストーラー (.dmg, .exe) の作成。
