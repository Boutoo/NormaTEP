import marimo

__generated_with = "0.17.7"
app = marimo.App(width="medium", app_title="NormaTEP", auto_download=["html"])


@app.cell
def _():
    import marimo as mo
    import pandas as pd
    import matplotlib.pyplot as plt
    import numpy as np
    return mo, np, pd


@app.cell
def _(mo, pd):
    stats = pd.read_csv(mo.notebook_location() / "public" / "normative_stats.csv")
    covariance = pd.read_csv(mo.notebook_location() / "public" / 'normative_covariance.csv')
    return (stats,)


@app.cell
def _(mahalanobis, np, pd):
    def compute_zscores(subject_data, stats_file='normative_stats.csv'):
        """
        subject_data: dict { 'Variable_Name': Value }
        """
        # --- Usage ---
        # subject_vals = {'15 - 120_8 - 12_RSP_Centro-Parietal Left': 0.5}
        # z_scores = compute_zscores(subject_vals)
        # print(z_scores)

        # Load norms and set Variable as index for fast lookup
        norms = pd.read_csv(stats_file).set_index('Variable')

        results = {}
        for var, value in subject_data.items():
            if var in norms.index:
                mu = norms.loc[var, 'Normative_Mean']
                sigma = norms.loc[var, 'Normative_Std']
                results[var] = (value - mu) / sigma

        return results

    def compute_d2(subject_data, stats_file='normative_stats.csv', cov_file='normative_covariance.csv'):
        """
        subject_data: dict { 'Variable_Name': Value }
        Returns: D2 score (float) and p-value (float)
        """
        # --- Usage ---
        # subject_vals = {
        #    '15 - 120_8 - 12_RSP_Centro-Parietal Left': 0.5,
        #    '15 - 300_BroadBand_PCIst_Global': 1.2
        # }
        # d2_score = compute_d2(subject_vals)
        # print(f"Mahalanobis Distance: {d2_score}")

        # 1. Load Data
        norms = pd.read_csv(stats_file).set_index('Variable')
        # Read covariance, setting the first column (Variable names) as index
        cov_df = pd.read_csv(cov_file, index_col=0) 

        # 2. Drop metadata columns (Cluster, Band, etc) if they exist in the CSV to get pure matrix
        # Assuming the first 4 cols are metadata based on previous step
        metric_cols = cov_df.columns[4:] 
        cov_df = cov_df.loc[metric_cols, metric_cols]

        # 3. Filter: Only use variables present in BOTH the subject input AND the covariance matrix
        valid_vars = [v for v in metric_cols if v in subject_data]

        if not valid_vars: return None

        # 4. Create Vectors (Order matters! Must match cov_df)
        x = np.array([subject_data[v] for v in valid_vars])
        mu = norms.loc[valid_vars, 'Normative_Mean'].values
        cov = cov_df.loc[valid_vars, valid_vars].values

        # 5. Calculate
        inv_cov = np.linalg.inv(cov)
        d2 = mahalanobis(x, mu, inv_cov) ** 2

        return d2
    return


@app.cell
def _(mo, stats):
    KEYS = ['Measure', 'Time', 'Band', 'Cluster']
    stats_filter = {
        key: mo.ui.multiselect.from_series(stats[key]) for key in KEYS
    }
    return (KEYS,)


@app.cell
def _(mo, stats):
    stats_info = f"""
    #{mo.icon('lucide:chart-column')} Normative Stats and Reliability
    """
    mo.vstack([mo.md(stats_info), stats])
    return


@app.cell
def _(KEYS, mo, stats):
    def fabricar_linha_input(id_linha):
        """
        Gera um dicionário de widgets UI representando um único registro de dados.
        O encapsulamento em mo.ui.dictionary permite o acesso unificado aos dados.
        """
        dict = {key: mo.ui.dropdown.from_series(stats[key]) for key in KEYS}
        return mo.ui.dictionary(dict)

    # Botões de Controle
    btn_add = mo.ui.button(label="Adicionar Linha", kind="neutral")
    btn_remove = mo.ui.button(label="Remover Linha", kind="warn")
    return btn_add, btn_remove, fabricar_linha_input


@app.cell
def _(mo):
    # Widget de controle de quantidade
    controle_qtd = mo.ui.number(start=1, stop=100, label="Número de Entradas")
    controle_qtd
    return


@app.cell
def _(btn_add, btn_remove, fabricar_linha_input, mo):
    get_linhas, set_linhas = mo.state([fabricar_linha_input(0)])

    # Lógica de Manipulação de Estado
    # Nota: Em Marimo, a lógica de clique geralmente verifica o valor do botão
    if btn_add.value:
        lista_atual = get_linhas()
        nova_linha = fabricar_linha_input(len(lista_atual))
        # Requer concatenação de listas criando novo objeto
        set_linhas(lista_atual + [nova_linha])

    if btn_remove.value:
        lista_atual = get_linhas()
        if len(lista_atual) > 0:
            set_linhas(lista_atual[:-1])
    return (get_linhas,)


@app.cell
def _(btn_add, btn_remove, get_linhas, mo):
    # Recupera os widgets do estado
    widgets_linhas = get_linhas()

    # Criação de Cabeçalhos
    cabecalho = mo.hstack(
       ['Measure'],
        justify="space-between"
    )

    # Renderização Visual
    # vstack contendo o cabeçalho e depois cada linha (que é um hstack)
    area_visual = mo.vstack([
        cabecalho,
        mo.vstack([
            mo.hstack(list(linha.elements.values()), justify="space-between")
            for linha in widgets_linhas
        ]),
        mo.hstack([btn_add, btn_remove], justify="center")
    ])
    area_visual
    return


@app.cell
def _(mo):
    mo.sidebar(
        [
            mo.md("# NormaTEP"),
            mo.nav_menu(
                {
                    "#/home": f"{mo.icon('lucide:home')} Home",
                    "#/about": f"{mo.icon('lucide:user')} About",
                    "#/contact": f"{mo.icon('lucide:phone')} Contact",
                    "Links": {
                        "https://github.com/Boutoo": "GitHub",
                    },
                },
                orientation="vertical",
            ),
        ]
    )
    return


if __name__ == "__main__":
    app.run()
