# 水族排班系統 - 部署指南

## 步驟一：Supabase 設定

1. 登入 https://supabase.com
2. 進入你的專案
3. 左邊選單點「SQL Editor」
4. 貼上以下 SQL 並按「Run」：

```sql
CREATE TABLE IF NOT EXISTS app_data (
  id TEXT PRIMARY KEY DEFAULT 'main',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_data (id, data) VALUES ('main', '{}')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON app_data FOR ALL USING (true) WITH CHECK (true);
```

5. 左邊選單點「Project Settings」→「API」
6. 記下這兩個值：
   - Project URL（像 https://xxxxx.supabase.co）
   - anon / public key（一長串英數字）

## 步驟二：上傳到 GitHub

1. 去 https://github.com 登入（沒有帳號就申請一個）
2. 點右上角「+」→「New repository」
3. 名稱填「aqua-scheduler」，其他不用改，按「Create repository」
4. 在新頁面會看到「uploading an existing file」連結，點它
5. 把這個資料夾裡的所有檔案拖進去上傳
6. 按「Commit changes」

## 步驟三：Vercel 部署

1. 登入 https://vercel.com
2. 點「Add New...」→「Project」
3. 選擇「Import Git Repository」，找到 aqua-scheduler
4. 在「Environment Variables」加入兩個變數：
   - 名稱：VITE_SUPABASE_URL ，值：你的 Project URL
   - 名稱：VITE_SUPABASE_ANON_KEY ，值：你的 anon key
5. 按「Deploy」等 1-2 分鐘

部署完成後會得到一個網址（像 aqua-scheduler.vercel.app）

## 步驟四：手機加到桌面

### iPhone：
1. 用 Safari 打開網址
2. 點底部的分享按鈕（方框+箭頭）
3. 選「加入主畫面」

### Android：
1. 用 Chrome 打開網址
2. 會自動跳出「安裝」提示，點安裝
3. 或點右上角選單 →「安裝應用程式」

## 預設帳號

- 管理員 PIN：0000
- 技師 A PIN：1111
- 技師 B PIN：2222
- 技師 C PIN：3333

登入後記得馬上改密碼！
