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
            </div>
        }
        
    }
}