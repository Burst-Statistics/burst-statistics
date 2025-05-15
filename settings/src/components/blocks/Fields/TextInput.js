const TextInput = ({ name, label, value, onChangeHandler }) => {

  function handleChange( e ) {
    onChangeHandler( e.target.value );
  }
  return (
    <div className="burst-field">
      <p className="burst-label">{label}</p>
      <input
        type="text"
        name={name}
        id={name}
        value={value}
        onChange={handleChange}
      />
    </div>
  );
};
export default TextInput;
