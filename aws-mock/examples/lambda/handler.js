exports.handler = async (event, context) => {
  try {
    console.log("Event:", JSON.stringify(event));
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Success" }),
    };
  } catch (error) {
    console.error("Error:", error);
    throw new Error(`Handled error: ${error.message}`);
  }
};
