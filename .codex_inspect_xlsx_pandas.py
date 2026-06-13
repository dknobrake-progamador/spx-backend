import pandas as pd
files = [r"D:\downloads\38833FF26BA1D.UnigramPreview_g9c9v27vpyspw!App\(1)30-05-2026 DOUGLAS GABRIEL.xlsx", r"D:\downloads\38833FF26BA1D.UnigramPreview_g9c9v27vpyspw!App\(2)30-05-2026 DOUGLAS GABRIEL.xlsx"]
for path in files:
    print('FILE', path)
    df = pd.read_excel(path)
    print('SHAPE', df.shape)
    print('COLUMNS', list(df.columns))
    print(df.head(5).to_string())
    print('---')
