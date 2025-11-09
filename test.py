# %%
import numpy as np
import pandas as pd

times = {
    'Early': '15 - 120',
    'Mid': '120 - 180',
    'Late': '180 - 300',
    'Global': '15 - 300'
}

clusters = {
    'Centro-Parietal Left': ['CP3', 'CP5'],
    'Parietal Left': ['P3', 'P5'],
    'Parietal Right': ['P4', 'P6'],
    'Centro-Parietal Right': ['CP4', 'CP6']
}

bands = {
    'Delta': [0.5, 4],
    'Theta': [4, 8],
    'Alpha': [8, 12],
    'Beta': [12, 30],
    'Gamma': [30, 100]
}

measures = ['ERSP', 'RSP', 'GMFP', 'LMFP', 'PCIst', 'NF']


weigths = {
    'Early': 1.6,
    'Alpha': 1.5,
    'Beta': 1.4,
    'Gamma': 0.5,
    'GMFP': 2,
    'ERSP': 0.9,
    'RSP': 1.5,
    'NF': 0.5
}

data = []

for m in measures:
    for t in times:
        for c in clusters:
            for b in bands:
                    data.append({
                        'Measure': m,
                        'Time': t,
                        'Cluster': c,
                        'Band': b,
                        'Mean': np.random.randn()*np.sum([v for w, v in weigths.items() if w in [m, t, c, b]]),
                        'Std': np.random.randn()*np.sum([v for w, v in weigths.items() if w in [m, t, c, b]])*0.1
                    })

df = pd.DataFrame(data)

# %% Save file
file_path = 'norm.csv'
df.to_csv(file_path, index=False)
