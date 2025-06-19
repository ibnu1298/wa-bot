exports.success = (message, data = null) => {
  if (data == null) {
    return {
      success: true,
      message,
    };
  }
  return {
    success: true,
    message,
    data,
  };
};

exports.error = (message, data = null) => {
  if (data == null) {
    return {
      success: false,
      message,
    };
  }
  return {
    success: false,
    message,
    data,
  };
};
