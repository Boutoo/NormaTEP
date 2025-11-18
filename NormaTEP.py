import marimo

__generated_with = "0.17.7"
app = marimo.App(width="medium", app_title="NormaTEP", auto_download=["html"])


@app.cell
def _():
    import marimo as mo
    import pandas as pd
    import numpy as np
    return mo, np, pd


@app.cell
def _(pd):
    stats_path = "https://boutoo.github.io/NormaTEP/public/normative_stats.csv?raw=True"
    stats = pd.read_csv(stats_path)
    covariance_path = "https://boutoo.github.io/NormaTEP/public/normative_covariance.csv?raw=True"
    covariance = pd.read_csv(covariance_path)
    return covariance, stats


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
    #📊 Normative Stats and Reliability
    """
    mo.vstack([mo.md(stats_info), stats])
    return


@app.cell
def _(covariance, mahalanobis, norms, np, stats):
    def compute_zscore(var, value):
        """
        subject_data: dict { 'Variable_Name': Value }
        """
        # --- Usage ---
        # subject_vals = '15 - 120_8 - 12_RSP_Centro-Parietal Left': 0.5
        # z_scores = compute_zscores(subject_vals)
        # print(z_scores)

        norms = stats
        norms['Variable_Name'] = norms.apply(
            lambda row: f"{row['Time']}_{row['Band']}_{row['Measure']}_{row['Cluster']}", axis=1
        )
        norms = norms.set_index('Variable_Name')
        if var in norms.index:
            mu = norms.loc[var, 'Normative_Mean']
            sigma = norms.loc[var, 'Normative_Std']
            result = (value - mu) / sigma
        else:
            result = 'N/A'
        return result

    def compute_d2(subject_data):
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
        # Read covariance, setting the first column (Variable names) as index
        cov_df = covariance

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
    return (compute_zscore,)


@app.cell
def _(get_rows):
    def get_subject_data(row=None):
        columns = ['Time', 'Band', 'Measure', 'Cluster', 'Value']
        subject_data = {}
        if row is not None:
            var = '_'.join([str(row.get(col).value) for col in columns[:-1]])
            return var, row.get('Value').value

        rows = get_rows()
        for row in rows:
            var = '_'.join([str(row.get(col).value) for col in columns[:-1]])
            subject_data[var] = row.get('Value').value
        return subject_data
    return (get_subject_data,)


@app.cell
def _(mo, stats):
    def create_row(defaults=None):
        # 1. If no defaults provided, use empty dict
        if defaults is None:
            defaults = {}

        return mo.ui.dictionary({
            "Measure": mo.ui.dropdown.from_series(
                stats['Measure'], 
                value=defaults.get('Measure', None)
            ),
            "Time": mo.ui.dropdown.from_series(
                stats['Time'], 
                value=defaults.get('Time', None)
            ),
            "Band": mo.ui.dropdown.from_series(
                stats['Band'], 
                value=defaults.get('Band', None)
            ),
            "Cluster": mo.ui.dropdown.from_series(
                stats['Cluster'], 
                value=defaults.get('Cluster', None)
            ),
            "Value": mo.ui.number(
                value=defaults.get('Value', 0.0)
            ),
            "Z-Score": mo.ui.text(
                disabled=True, 
                value=defaults.get('Z-Score', "")
            ),
        })
    return (create_row,)


@app.cell
def _(create_row, get_rows, set_rows):
    def set_row_value(row_index, key, new_value):
        # 1. Get current state
        current_rows_list = get_rows()

        # Guard clause: prevent index out of bounds
        if row_index < 0 or row_index >= len(current_rows_list):
            return

        # 2. Get the current data from the widget
        # .value extracts the dictionary: {'Measure': 'A', 'Value': 10, ...}
        row_data = current_rows_list[row_index].value.copy()

        # 3. Update the specific key
        row_data[key] = new_value

        # 4. Create a NEW widget for this row using the updated data
        new_row_widget = create_row(defaults=row_data)

        # 5. Reconstruct the list and update state
        # We use a slice copy or list() to ensure a new reference
        updated_rows_list = list(current_rows_list)
        updated_rows_list[row_index] = new_row_widget

        set_rows(updated_rows_list)
    return (set_row_value,)


@app.cell
def _(compute_zscore, get_rows, get_subject_data, set_row_value):
    def compute_subject_score():
        for r, row in enumerate(get_rows()):
            var, value = get_subject_data(row)
            z_score = compute_zscore(var, value)
            set_row_value(r, 'Z-Score', f"{z_score:.2f}" if isinstance(z_score, float) else z_score)
        print("Z-scores updated in the table.")
    return (compute_subject_score,)


@app.cell
def _(create_row, mo):
    get_rows, set_rows = mo.state([create_row()], allow_self_loops=True)
    return get_rows, set_rows


@app.cell
def _(compute_subject_score, create_row, get_rows, mo, set_rows):
    def add_row():
        set_rows(get_rows() + [create_row()])

    def remove_row():
        if len(get_rows()) > 1:
            set_rows(get_rows()[:-1])

    btn_add = mo.ui.button(label="Add Input", on_click=lambda _: add_row())
    btn_remove = mo.ui.button(label="Remove Input", on_click=lambda _: remove_row())

    btn_compare = mo.ui.button(label="Compare with Normative", on_click=lambda _: compute_subject_score())

    # Group buttons
    controls = mo.hstack([btn_add, btn_remove], justify="start")
    return btn_compare, controls


@app.cell
def _(KEYS, btn_compare, controls, get_rows, mo):
    # --- Layout & Display ---
    rows = get_rows()
    print(rows)
    columns = KEYS + ['Value', 'Z-Score']
    body_lines = []
    for row in rows:
        row_values = [f"{row.get(col, '')}" for col in columns[:-1]]
        z_value = row.get('Z-Score', '')
        try:
            z_color = "red" if abs(float(z_value.value)) >= 2 else "green"
        except:
            z_color = "black"
        row_values += [f"<span style='color: {z_color}; font-weight:bold'>{z_value}</span>"]
        body_lines.append(f"| {' | '.join(row_values)} |")

    # Join the rows with newlines
    table_body = "\n".join(body_lines)

    # 3. Construct the display string
    comparisson_display = f"""
    # 🔍 Comparison Tool

    | {' | '.join(columns)} |
    | {' | '.join(['---'] * len(columns))} |
    {table_body}

    {controls}
    {mo.hstack([btn_compare], justify="end")}
    """

    mo.md(comparisson_display)
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


@app.cell
def _():
    return


if __name__ == "__main__":
    app.run()
