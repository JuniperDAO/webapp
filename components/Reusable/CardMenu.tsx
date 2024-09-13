const CardMenu = () => {
    return (
        <>
            <li onClick={() => console.log('Disconnect Card')}>Disconnect This Card</li>
            <li className="bg-black" onClick={() => console.log('Spending Power?')}>
                What is Spending Power?
            </li>
        </>
    )
}

export default CardMenu
