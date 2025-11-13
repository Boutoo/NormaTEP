import marimo

__generated_with = "0.17.7"
app = marimo.App(
    width="medium",
    app_title="NormaTEP",
    layout_file="layouts/NormaTEP.grid.json",
    auto_download=["html"],
)


@app.cell
def _():
    import marimo as mo
    import pandas as pd
    import matplotlib.pyplot as plt
    import numpy as np
    return mo, pd


@app.cell
def _(pd):
    df = pd.read_csv('norm.csv')
    filtered_df = df.copy()
    return df, filtered_df


@app.cell
def _(filtered_df, mo):
    mo.md("<h1> Normative Tool <h2>")
    KEYS = ['Measure', 'Time', 'Cluster', 'Band']
    FILTERS = {
        key: [] for key in KEYS
    }

    def on_filter_changed(key, x):
        print(f"{key}: {x}")

    def get_filters_ui():
        FILTERS_UI = {
            key: mo.ui.multiselect.from_series(filtered_df[key], on_change= lambda x: on_filter_changed(key, x)) for key in KEYS
        }
        return FILTERS_UI
    return FILTERS, get_filters_ui


@app.cell
def _(get_filters_ui, mo):
    def _():
        items = []
        for item in get_filters_ui().values():
            items.append(item)
        return mo.vstack(items)
    _()
    return


@app.cell
def _(FILTERS, df):
    filt_df = df.copy()
    for name, value in FILTERS.items():
        if value: filt_df = df[df[name].isin(value)]
    filt_df
    return


@app.cell
def _(df, mo):
    labels = ['Measure', 'Time', 'Band', 'Cluster']
    inputs = {key:mo.ui.dropdown.from_series(df[key], allow_select_none=False, value=df[key].unique()[0]) for key in labels}
    mo.md("<h1> Comparisson Tool 🔎 <h2>")
    return


@app.cell
def _(df, mo):
    # Helper function to create a single row of UI elements
    def create_new_row():
        return [
            mo.ui.dropdown.from_series(df['Measure'], label=None),
            mo.ui.dropdown.from_series(df['Time'], label=None),
            mo.ui.dropdown.from_series(df['Cluster'], label=None),
            mo.ui.dropdown.from_series(df['Band'], label=None),
            mo.ui.text(label=None),
            mo.ui.text(label=None, disabled=True)
        ]
    rows = [create_new_row()]

    def add_row(x=None):
        global rows
        rows.append(create_new_row())

    def remove_row(x=None):
        global rows
        rows = rows[:-1] if len(rows)>=1 else rows[0]

    add_button = button = mo.ui.button(on_click=add_row, label="Add", kind="info")
    remove_button = mo.ui.button(on_click=remove_row, label='Remove last', kind='danger')
    run_button = mo.ui.button(label='RUN', kind='success', full_width=True)
    return add_button, remove_button, rows, run_button


@app.cell
def _(add_button, mo, remove_button, rows, run_button):
    input_table = f"""
    | Measure | Time | Cluster | Band | Value | Z-Score |
    |:-------:|:-------:|:-------:|:-------:|:-------:| :-------:|
    """
    for row in rows:
        input_table += '|'.join(f"{input}" for input in row)
        input_table += '\n'
    input_table += f"""
    {add_button} {remove_button}

    **{run_button}**
    """
    mo.md(input_table)
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
