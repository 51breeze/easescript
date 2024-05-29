package components{

    import components.List;

    class Child{

        protected render():object{
            return <div>
                <List>
                    <slot:default scope="scope">
                        <div d:for="item in scope">{item}</div>
                    </slot:default>
                </List>
                <List>
                    <slot:default scope="{items, name='sss'}">
                        <div d:for="item in items">{item}</div>
                    </slot:default>
                </List>
                <List>
                    <slot:default props="props">
                        <div d:for="item in props.items">{item}</div>
                    </slot:default>
                </List>
            </div>
        }
        
    }
}