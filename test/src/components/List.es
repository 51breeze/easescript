package components{
    class List{
        protected render():object{
            return <div sss="ss">
                <div>@{'1'}</div>
                <div>
                    <slot:default items={['name']} name={"test"} />
                </div>
            </div>
        }
    }
}