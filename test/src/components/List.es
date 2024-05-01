package components{
    class List{
        protected render():object{
            return <div sss="ss">
                <div>=========List Component===</div>
                <div>
                    <slot:default items={['name']} name={"test"} />
                </div>
            </div>
        }
    }
}