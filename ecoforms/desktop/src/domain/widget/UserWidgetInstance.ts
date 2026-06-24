export type WidgetType = 'kpi_card' | 'bar_chart' | 'pie_chart' | 'line_chart' | 'area_chart' | 'table' | 'recent_activity';

export interface UserWidgetInstanceProps {
    id: string;
    user_id: string;
    dashboard_id: string;
    widget_type: WidgetType;
    data_source: string;
    display_config: string;
    position_x: number;
    position_y: number;
    position_w: number;
    position_h: number;
    position_order: number;
    criado_em: string;
    atualizado_em: string;
}

export class UserWidgetInstance {
    private constructor(private props: UserWidgetInstanceProps) {}

    static fromRow(row: Record<string, unknown>): UserWidgetInstance {
        return new UserWidgetInstance({
            id: row.id as string,
            user_id: row.user_id as string,
            dashboard_id: row.dashboard_id as string,
            widget_type: row.widget_type as WidgetType,
            data_source: typeof row.data_source === 'string' ? row.data_source : JSON.stringify(row.data_source ?? {}),
            display_config: typeof row.display_config === 'string' ? row.display_config : JSON.stringify(row.display_config ?? {}),
            position_x: Number(row.position_x) || 0,
            position_y: Number(row.position_y) || 0,
            position_w: Number(row.position_w) || 6,
            position_h: Number(row.position_h) || 1,
            position_order: Number(row.position_order) || 0,
            criado_em: row.criado_em as string,
            atualizado_em: row.atualizado_em as string,
        });
    }

    static fromProps(props: UserWidgetInstanceProps): UserWidgetInstance {
        return new UserWidgetInstance({ ...props });
    }

    toRow(): Record<string, unknown> {
        return {
            id: this.props.id,
            user_id: this.props.user_id,
            dashboard_id: this.props.dashboard_id,
            widget_type: this.props.widget_type,
            data_source: this.props.data_source,
            display_config: this.props.display_config,
            position_x: this.props.position_x,
            position_y: this.props.position_y,
            position_w: this.props.position_w,
            position_h: this.props.position_h,
            position_order: this.props.position_order,
            criado_em: this.props.criado_em,
            atualizado_em: this.props.atualizado_em,
        };
    }

    get id(): string { return this.props.id; }
    get user_id(): string { return this.props.user_id; }
    get dashboard_id(): string { return this.props.dashboard_id; }
    get widget_type(): WidgetType { return this.props.widget_type; }
    get data_source(): string { return this.props.data_source; }
    get display_config(): string { return this.props.display_config; }
    get position_x(): number { return this.props.position_x; }
    get position_y(): number { return this.props.position_y; }
    get position_w(): number { return this.props.position_w; }
    get position_h(): number { return this.props.position_h; }
    get position_order(): number { return this.props.position_order; }
}
